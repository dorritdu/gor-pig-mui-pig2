export const PICNIC_NOTICE_TEXT = `通告 Notice
學校旅行 School Picnic
日期 Date: 21 March 2026 (Friday)
地點 Venue: Ocean Park 海洋公園
學生須帶 Items: white sports shoes, water bottle, snack, signed reply slip
家長請於 20/3 前交回 $120 及回條
Please return $120 and reply slip by 20 March.`;

export const PICNIC_EXTRACT_JSON = `{
  "summary": "豬2 21 Mar 2026 Ocean Park picnic; bring white shoes, water, snack, signed slip; pay $120 by 20 Mar.",
  "rawText": ${JSON.stringify(PICNIC_NOTICE_TEXT)},
  "events": [
    {
      "title": "學校旅行 / School Picnic",
      "childGuess": "unknown",
      "organisationGuess": "學校 C",
      "startDate": "2026-03-21",
      "startTime": null,
      "endDate": "2026-03-21",
      "endTime": null,
      "location": "海洋公園 / Ocean Park",
      "type": "trip",
      "itemsToBring": ["白鞋", "水", "小食", "已簽回條"],
      "uniform": null,
      "notes": "School picnic circular",
      "tasks": [
        { "title": "交 $120 旅行費", "dueDate": "2026-03-20", "assigneeRole": "parent" },
        { "title": "簽回條", "dueDate": "2026-03-20", "assigneeRole": "parent" }
      ]
    }
  ]
}`;
