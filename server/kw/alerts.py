"""User alerts for any place on Earth, delivered by email (built in) or by the user's own n8n.

Triggers (each alert picks any of them):
  anomaly  the month so far tops N x the median of the same days in earlier years (at most once per month)
  outlook  the place's 30-day outlook has watch cells: fire season ahead AND already above normal (at most weekly)
  events   NASA EONET lists a new open wildfire event inside the box

No accounts: the unguessable token is the credential. Email is double opt-in (a confirm link is mailed first) and
every message carries a one-click unsubscribe link. SMTP comes from env (SMTP_HOST, SMTP_PORT, SMTP_USER,
SMTP_PASSWORD, SMTP_FROM); without it, alerts still work through n8n or the poll endpoint.
"""
import datetime as dt
import html
import json
import os
import re
import secrets
import smtplib
import ssl
import threading
import time
from email.message import EmailMessage

from . import tools
from .firms import DATA

FILE = DATA / "alerts.json"
MAX_ALERTS = 2000
MAX_PER_EMAIL = 20
TRIGGERS = ("anomaly", "outlook", "events")
EMAIL_RE = re.compile(r"^[^@\s<>\"']{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}$")
_lock = threading.Lock()  # ponytail: one file + one lock; move to SQLite if alerts or writers grow


def _load():
    return json.loads(FILE.read_text(encoding="utf-8")) if FILE.exists() else {}


def _save(d):
    FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, FILE)


def _update(token, **kv):
    with _lock:
        d = _load()
        if token in d:
            d[token].update(kv)
            _save(d)


def tops(value, median, ratio, floor):
    """True when the month so far exceeds ratio x the median of the same days in earlier years, and is not tiny."""
    return value >= floor and value > ratio * median


def _label(period):
    return dt.date(int(period[:4]), int(period[5:7]), 1).strftime("%B %Y")


def _now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def mask(email):
    if not email:
        return None
    user, _, dom = email.partition("@")
    return f"{user[:1]}{'*' * max(1, len(user) - 1)}@{dom}"


# ---------- email ----------

def smtp_ready():
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_FROM"))


def send_email(to, subject, text, html_body=None):
    if not smtp_ready():
        raise RuntimeError("email delivery is not configured on this server (set SMTP_HOST and SMTP_FROM)")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = os.environ["SMTP_FROM"], to, subject
    msg.set_content(text)
    if html_body:
        msg.add_alternative(html_body, subtype="html")
    host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587"))
    user, pw = os.environ.get("SMTP_USER"), os.environ.get("SMTP_PASSWORD")
    ctx = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as s:
            if user:
                s.login(user, pw or "")
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=30) as s:
            if os.environ.get("SMTP_TLS", "1") != "0":  # SMTP_TLS=0 only for a local relay (MailHog, postfix on localhost)
                s.starttls(context=ctx)
            if user:
                s.login(user, pw or "")
            s.send_message(msg)


def _page_url(sub):
    return f"{sub.get('base_url', '').rstrip('/')}/#pg=explore&r={sub['region_id']}"


def _html(title, paras, sub, token, footer_link=True):
    esc = [f"<p style='margin:0 0 12px;line-height:1.5'>{p}</p>" for p in paras]
    base = sub.get("base_url", "").rstrip("/")
    unsub = f"{base}/api/alerts/{token}/unsubscribe?code={sub.get('code', '')}"
    foot = (f"<p style='color:#8892a0;font-size:12px'>A climatological outlook from NASA FIRMS satellite detections "
            f"(MODIS, VIIRS), harmonized by Kiln Watch. Not a forecast and not an official alert. "
            f"<a href='{unsub}' style='color:#8892a0'>Unsubscribe</a></p>") if footer_link else ""
    return (f"<div style='font-family:Inter,Arial,sans-serif;background:#05080d;color:#f1f4f8;padding:24px'>"
            f"<div style='max-width:560px;margin:auto'><p style='color:#ff7a6e;font-size:11px;letter-spacing:.12em;"
            f"text-transform:uppercase;margin:0 0 8px'>Kiln Watch</p><h1 style='font-size:20px;margin:0 0 14px'>"
            f"{html.escape(title)}</h1>{''.join(esc)}<p><a href='{_page_url(sub)}' style='background:#00a1ff;color:#00121f;"
            f"padding:9px 14px;text-decoration:none;font-weight:700;font-size:12px;text-transform:uppercase'>Open the "
            f"record</a></p>{foot}</div></div>")


def _send_confirm(token, sub):
    url = f"{sub.get('base_url', '').rstrip('/')}/api/alerts/{token}/confirm?code={sub['code']}"
    name = html.escape(sub.get("name") or sub["region_id"])
    send_email(sub["email"], f"Confirm your Kiln Watch alert for {sub.get('name') or sub['region_id']}",
               f"Confirm your fire alert for {sub.get('name')}: {url}\nIf you did not ask for this, ignore this email.",
               _html("Confirm your fire alert", [f"Someone (hopefully you) asked Kiln Watch to email this address about "
                     f"fire activity in <b>{name}</b>.", f"<a href='{url}' style='color:#00a1ff'>Confirm the alert</a>. "
                     "If you did not ask for this, ignore this email and nothing will be sent."], sub, token, False))


# ---------- CRUD ----------

def create(region_id=None, bbox=None, name=None, ratio=1.0, min_hotspots=5.0, email=None, triggers=None, base_url=""):
    ratio, floor = float(ratio), float(min_hotspots)
    if not (0.5 <= ratio <= 20) or not (0 <= floor <= 1000):
        raise ValueError("ratio must be 0.5-20 and min_hotspots 0-1000")
    triggers = list(dict.fromkeys(triggers or ["anomaly"]))
    if not triggers or any(t not in TRIGGERS for t in triggers):
        raise ValueError(f"triggers must be some of {', '.join(TRIGGERS)}")
    email = (email or "").strip() or None
    if email and not EMAIL_RE.match(email):
        raise ValueError("that does not look like an email address")
    if region_id:
        area = next((r for r in tools.list_regions() if r["id"] == region_id), None)
        if not area:
            raise tools.NotFound(f"unknown region '{region_id}'")
        rid, bbox, name = region_id, area["bbox"], name or area["name"]
    else:
        rid = tools.start_aoi(bbox, name)["id"]  # builds the area if nobody has asked for it yet
        bbox = list(tools.validate_bbox(bbox))
    with _lock:
        d = _load()
        if len(d) >= MAX_ALERTS:
            raise ValueError("alert limit reached")
        if email and sum(s.get("email") == email for s in d.values()) >= MAX_PER_EMAIL:
            raise ValueError(f"at most {MAX_PER_EMAIL} alerts per email address")
        if email and sum(s.get("email") == email and not s.get("confirmed") for s in d.values()) >= 3:
            raise ValueError("this address has 3 unconfirmed alerts: confirm those first (check the inbox)")  # anti-spam
        token = secrets.token_urlsafe(9)
        d[token] = {"region_id": rid, "bbox": bbox, "name": name, "ratio": ratio, "min_hotspots": floor,
                    "created": _now(), "last_notified": None, "triggers": triggers, "email": email,
                    "confirmed": False, "code": secrets.token_urlsafe(16), "base_url": base_url,
                    "last_outlook": None, "events_seen": [], "sent": []}
        _save(d)
        sub = dict(d[token])
    email_status = None
    if email:
        try:
            _send_confirm(token, sub)
            email_status = "confirmation_sent"
        except Exception as ex:  # surfaced, never swallowed: the UI tells the user to use n8n instead
            email_status = f"not_sent: {str(ex)[:160]}"
    return {"token": token, **public(sub), "email_status": email_status}


def public(sub):
    """What an API caller may see: the email masked, the confirm code never."""
    return {k: v for k, v in sub.items() if k not in ("code", "email", "events_seen", "sent")} | {
        "email": mask(sub.get("email")), "sent": (sub.get("sent") or [])[-10:]}


def delete(token):
    with _lock:
        d = _load()
        if d.pop(token, None) is None:
            raise tools.NotFound("unknown alert")
        _save(d)
    return {"deleted": True}


def get(token):
    sub = _load().get(token)
    if not sub:
        raise tools.NotFound("unknown alert")
    return sub


def confirm(token, code):
    sub = get(token)
    if not code or not secrets.compare_digest(code, sub.get("code") or ""):
        raise ValueError("this confirmation link is not valid")
    _update(token, confirmed=True)
    return {**public(sub), "confirmed": True}


def unsubscribe(token, code):
    sub = get(token)
    if not code or not secrets.compare_digest(code, sub.get("code") or ""):
        raise ValueError("this unsubscribe link is not valid")
    _update(token, email=None, confirmed=False)
    return {"unsubscribed": True, "name": sub.get("name")}


# ---------- checking ----------

def _message(name, m, as_of):
    med = m["median_same_days"]
    vs = (f"median {med:.0f} in earlier years" if not med
          else f"{m['value'] / med:.1f}x the median of the same days in earlier years ({med:.0f})")
    return (f"Kiln Watch alert for {name}. {_label(m['period'])} so far ({m['days']} days): {m['value']:.0f} hotspots, "
            f"{vs}; {m['percentile']:.0f}th percentile, rank {m['rank']} of {m['of_years']}. "
            f"This compares with history; it is not a forecast or an official alert. Data through {as_of}.")


def _outlook(bbox):
    try:
        from . import outlook
        return outlook.in_box(bbox, limit=10)
    except Exception:  # no global aggregate on this server: the trigger is simply unavailable
        return None


def _events(bbox):
    w, s, e, n = bbox
    try:
        evs = tools.news.open_wildfires()
    except Exception:
        return None
    return [x for x in evs if s <= x["lat"] <= n and ((w <= x["lon"] <= e) if w <= e else (x["lon"] >= w or x["lon"] <= e))]


def check(token, once=False):
    """Current state of one alert. once=True is the scheduled poll (n8n or the email loop): each hit is reported
    once (anomaly once per month, outlook at most weekly, each EONET event once), then marked."""
    sub = get(token)
    rid = sub["region_id"]
    trig = sub.get("triggers") or ["anomaly"]
    base = {"token": token, "region_id": rid, "name": sub["name"], "ratio": sub["ratio"], "triggers": trig,
            "min_hotspots": sub["min_hotspots"], "triggered": False, "email": mask(sub.get("email")),
            "confirmed": bool(sub.get("confirmed")), "sent": (sub.get("sent") or [])[-10:]}
    ol = _outlook(sub["bbox"]) if "outlook" in trig else None
    evs = _events(sub["bbox"]) if "events" in trig else None
    extra = {"outlook": ol and {k: ol[k] for k in ("as_of", "next_30_days", "counts", "rising")},
             "events_in_box": evs}
    new_events = [x for x in (evs or []) if x["title"] not in (sub.get("events_seen") or [])]
    last_ol = sub.get("last_outlook")
    ol_hit = bool(ol and ol["counts"]["watch"])
    ol_new = ol_hit and (not last_ol or (dt.date.fromisoformat(ol["as_of"]) - dt.date.fromisoformat(last_ol)).days >= 7)
    if not tools.is_built(rid):
        try:
            st = tools.aoi_status(rid)
            if st["status"] == "error" and once:  # the daily poll doubles as the retry
                st = tools.start_aoi(sub["bbox"], sub["name"])
        except tools.NotFound:  # server restarted mid-build
            st = tools.start_aoi(sub["bbox"], sub["name"])
        return {**base, **extra, "status": st["status"], "progress": {k: st.get(k) for k in ("done", "total", "stage")},
                "error": st.get("error"), "outlook_triggered": ol_new if once else ol_hit,
                "new_events": new_events if once else []}
    refreshing = tools.refresh_if_stale(rid)
    w = tools.early_warning(rid)
    m = w["month"]
    name = sub["name"] or w["name"]
    hit = "anomaly" in trig and bool(m) and tops(m["value"], m["median_same_days"], sub["ratio"], sub["min_hotspots"])
    new = hit and sub["last_notified"] != m["period"]
    if once and (new or ol_new or new_events):
        with _lock:
            d = _load()
            if token in d:  # ponytail: marked before delivery; a failed send is not retried
                if new:
                    d[token]["last_notified"] = m["period"]
                if ol_new:
                    d[token]["last_outlook"] = ol["as_of"]
                if new_events:
                    d[token]["events_seen"] = ((d[token].get("events_seen") or []) + [x["title"] for x in new_events])[-200:]
                _save(d)
    out = {**base, **extra, "name": name, "status": "ready", "triggered": new if once else hit,
           "already_notified": bool(once and hit and not new), "level": w["level"], "as_of": w["as_of"],
           "stale": w["stale"], "refreshing": refreshing, "month": m,
           "outlook_triggered": ol_new if once else ol_hit, "new_events": new_events if once else [],
           "rule": f"Alert when the month so far is above {sub['ratio']:g} x the median of the same days in earlier "
                   f"years and at least {sub['min_hotspots']:g} hotspots."}
    if m:
        out["message"] = _message(name, m, w["as_of"])
    return out


def _digest(sub, st):
    """(subject, text, html paragraphs) for whatever fired; None when nothing did."""
    name = st.get("name") or sub["name"]
    parts, paras = [], []
    if st.get("triggered") and st.get("month"):
        m = st["month"]
        parts.append(st["message"])
        med, val = m["median_same_days"], m["value"]
        vs = f", <b>{val / med:.1f}×</b> the median of the same days in earlier years ({med:.0f})" if med else ""
        paras.append(f"<b>{_label(m['period'])} so far is above your threshold.</b> {val:.0f} hotspots in "
                     f"{m['days']} days{vs}; rank <b>{m['rank']} of {m['of_years']}</b> ({m['percentile']:.0f}th percentile).")
    if st.get("outlook_triggered") and st.get("outlook"):
        o = st["outlook"]
        c = o["counts"]
        t = (f"30-day outlook ({o['next_30_days'][0]} to {o['next_30_days'][1]}): {c['watch']} cells in this area "
             f"enter a usually active fire season while already above normal; {c['above']} more above normal.")
        parts.append(t)
        paras.append(f"<b>Fire-season watch for the next 30 days.</b> {c['watch']} half-degree cells here usually see "
                     f"an active season now and are already running above the same days in earlier years "
                     f"({c['above']} more above normal, {o['rising']} with a season that usually ramps up now).")
    for e in st.get("new_events") or []:
        parts.append(f"NASA EONET open wildfire event: {e['title']} ({e['date']}) {e.get('url') or ''}")
        paras.append(f"<b>New wildfire event reported:</b> {html.escape(e['title'])} ({e['date']}) "
                     + (f"<a href='{html.escape(e['url'])}' style='color:#00a1ff'>source</a>" if e.get("url") else ""))
    if not parts:
        return None
    kind = "Fire activity above normal" if st.get("triggered") else "Fire-season watch" if st.get("outlook_triggered") else "New wildfire event"
    return f"{kind}: {name}", "\n\n".join(parts) + f"\n\nOpen the record: {_page_url(sub)}", paras


def send_now(token, force=False):
    """Check one alert and email whatever fired. force=True mails the current status even if nothing fired (test)."""
    sub = get(token)
    if not sub.get("email") or not sub.get("confirmed"):
        raise ValueError("this alert has no confirmed email address")
    sent = sub.get("sent") or []
    if force and sent and time.time() - dt.datetime.fromisoformat(sent[-1]["at"]).timestamp() < 600:
        raise ValueError("a message was sent less than 10 minutes ago; try again later")
    st = check(token, once=not force)
    if st.get("status") != "ready" and not force:
        return {"sent": False, "reason": "area still building"}
    dg = _digest(sub, st)
    if not dg and force:
        m = st.get("month")
        para = (f"Status of <b>{html.escape(st.get('name') or '')}</b>: early-warning level <b>{st.get('level', 'pending')}</b>."
                + (f" {_label(m['period'])} so far: {m['value']:.0f} hotspots, median of earlier years "
                   f"{m['median_same_days']:.0f}." if m else ""))
        dg = (f"Kiln Watch test: {st.get('name')}", st.get("message") or "Alert is set up; nothing has fired yet.", [para,
              "Nothing has crossed your thresholds yet. You will get a message like this when it does."])
    if not dg:
        return {"sent": False, "reason": "nothing new fired"}
    subject, text, paras = dg
    send_email(sub["email"], subject, text, _html(subject, paras, sub, token))
    rec = {"at": _now(), "subject": subject}
    with _lock:
        d = _load()
        if token in d:
            d[token]["sent"] = ((d[token].get("sent") or []) + [rec])[-50:]
            _save(d)
    return {"sent": True, **rec}


def deliver_all():
    """One pass of the email loop: every confirmed email alert is checked and mailed if something new fired."""
    done = []
    for token, sub in list(_load().items()):
        if sub.get("email") and sub.get("confirmed"):
            try:
                done.append({"token": token[:3] + "…", **send_now(token)})
            except Exception as ex:  # one bad alert never stops the others
                done.append({"token": token[:3] + "…", "sent": False, "error": str(ex)[:160]})
    return done


def start_loop(every_h=None):
    """Background email delivery inside the API process (daemon thread), every ALERT_INTERVAL_H hours (default 3)."""
    every = float(every_h or os.environ.get("ALERT_INTERVAL_H", "3")) * 3600

    def run():
        time.sleep(60)  # let the API come up first
        while True:
            if smtp_ready():
                try:
                    deliver_all()
                except Exception:  # noqa: BLE001 - the loop must survive anything
                    pass
            time.sleep(every)

    threading.Thread(target=run, daemon=True, name="alert-email").start()


def workflow(token, base_url):
    """An importable n8n workflow that polls this alert daily and emails when it triggers."""
    sub = get(token)
    url = f"{base_url.rstrip('/')}/api/alerts/{token}/poll"

    def conn(n):
        return {"main": [[{"node": n, "type": "main", "index": 0}]]}

    return {
        "name": f"Kiln Watch alert: {sub['name'] or sub['region_id']}",
        "nodes": [
            {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 7 * * *"}]}}, "id": "n1",
             "name": "Every morning", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0]},
            {"parameters": {"method": "POST", "url": url, "options": {}}, "id": "n2", "name": "Check Kiln Watch alert",
             "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [220, 0]},
            {"parameters": {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
             "conditions": [{"id": "c1", "leftValue": "={{ $json.triggered || $json.outlook_triggered || $json.new_events.length > 0 }}",
                             "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
             "combinator": "and"}, "options": {}}, "id": "n3", "name": "Anything new?",
             "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": [440, 0]},
            {"parameters": {"fromEmail": "kilnwatch@example.com", "toEmail": "you@example.com",
                            "subject": "={{ 'Kiln Watch alert: ' + $json.name }}", "emailFormat": "text",
                            "text": "={{ $json.message }}", "options": {}},
             "id": "n4", "name": "Send email", "type": "n8n-nodes-base.emailSend", "typeVersion": 2.1,
             "position": [660, -80]},
        ],
        "connections": {"Every morning": conn("Check Kiln Watch alert"),
                        "Check Kiln Watch alert": conn("Anything new?"),
                        "Anything new?": {"main": [[{"node": "Send email", "type": "main", "index": 0}], []]}},
        "settings": {"executionOrder": "v1"},
    }
