# Kiln Watch: 2-minute pitch script

**[0:00 Hook]** Every winter Dhaka's air turns brown. Two culprits get the blame: thousands of brick kilns, and farmers burning crop stubble. NASA satellites have watched those fires for twenty years. Plot that record naively, though, and it misleads you twice.

**[0:15 Problem 1: `money_jump.png`]** In 2012 NASA's new VIIRS sensor arrived. It sees fires about four times smaller than MODIS can. Splice the two records and burning in Bangladesh seems to triple overnight. It didn't. That jump comes from the sensor, not the land.

**[0:30 Harmonization]** Kiln Watch puts every satellite on one honest scale. On days when Aqua-MODIS and VIIRS both saw the same clear ground, we learn how many MODIS detections one VIIRS detection is worth, by region, month and day or night. Uncertainty comes from resampling whole seasons. The 2012 jump shrinks to **3%** of its raw size. A break test that fires on the raw record (p = 0.00006) goes quiet after harmonization (p = 0.29). The record carries on through NOAA-20 and NOAA-21 after S-NPP's shutdown on 1 November.

**[0:55 Problem 2: Story page, kiln card]** Next question: is kiln heat hiding in the fire record? We wrote the test down before looking. 3,653 kiln clusters against matched farmland: **0.46×** the detection rate. In fourteen years only 37 kiln clusters ever produced a single night-time fire detection. Fire satellites cannot see brick kilns, so the fire calendar is crop and forest burning.

**[1:15 The twist]** Kilns still matter for Dhaka's air, so we asked which NASA data *can* see them. Kilns run day and night from November to April, with workers living on site, and **NASA's Black Marble night lights** pick that up. Our first pilot looked promising. We wrote the rules down, then tested on 3,253 kiln clusters and a season the pilot never touched. 72% of them light up in the working season. Swap a kiln for its own control site and the signal disappears. Two calendars, two sensors: the kiln season now runs from mid-November to mid-April and peaks in February, and it has grown from about 90 days in 2012 to about 150 today.

**[1:40 Product]** For every district and upazila: every day since 2003 on one scale, the normal range, unusual days, critical periods, the current season updated daily, and the kiln season beside the fire calendar. Draw any box. Download everything. It works offline and in Bangla.

**[1:55 Close]** Kiln Watch: twenty years of fire on one honest scale, and the right satellite for the thing fire satellites can't see.
