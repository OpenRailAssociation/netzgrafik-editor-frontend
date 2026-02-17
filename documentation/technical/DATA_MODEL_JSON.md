## Netzgrafik-Editor data export/import (JSON)

The complete data export can be used for data exchange between different network graphics/variants, merging network graphics, or for user-specific customization,
including metadata such as colors and train categories, among others.

By exporting or importing data in JSON format, information can be efficiently and flexibly exchanged or connected between
different systems or applications. JSON format is a widely used format for exchanging structured data and allows for easy
integration and processing of information in third-party applications. Additionally, it provides a readable and easily
understandable representation of data, which facilitates manual editing.

[DATA MODEL](DATA_MODEL.md)

## Export/Import

![image](https://github.com/user-attachments/assets/df46327d-5a00-4510-ab8f-563292ce81f8)

#### Export

To export the current Netzgrafik use the `Export netzgrafik as JSON` button.

#### Import

The exported data in JSON format can be imported again using the `Import netzgrafik as JSON` button.

##### JSON-Based Data Import from 3rd Party Data Providers

If nodes have no port objects or if no TrainrunSection has a defined path element, the import process will automatically adjust,
respectively create the required elements. This adjustment ensures that all nodes are created first, followed by the systematic
insertion of each train, section by section. Inserting each section by section ensures that the Netzgrafik drawing gets well routed.
This streamlines the import process, making the exchange of data much more straightforward and efficient.
The 3rd party has only to care about the nodes' position and ensure the trainrun sections are temporally sorted. The TrainrunSection routing gets computed while importing,
thus no complex calculation must be reimplemented by the 3rd party provider.

###### Detection of Third-Party Data

The function [detectNetzgrafikJSON3rdParty](./../../src/app/view/editor-tools-view-component/editor-tools-view.component.ts#:~:text=detectNetzgrafikJSON3rdParty) checks if the imported data comes from a third party and if it needs to be adjusted accordingly.

```typescript
private detectNetzgrafikJSON3rdParty(netzgrafikDto: NetzgrafikDto): boolean {
  return (
    netzgrafikDto.nodes.find((n: NodeDto) => n.ports === undefined) !== undefined ||
    netzgrafikDto.nodes.filter((n: NodeDto) => n.ports?.length === 0).length ===
    netzgrafikDto.nodes.length ||
    netzgrafikDto.trainrunSections.find(
      (ts: TrainrunSectionDto) =>
        ts.path === undefined || ts.path?.path === undefined || ts.path?.path?.length === 0,
    ) !== undefined
  );
}
```

The function performs the following checks:

- Whether there are nodes without port objects.
- Whether all nodes have empty port lists.
- Whether there are trainrun sections without a defined path.
  If any of these conditions are met, the import process is adjusted to automatically create the necessary elements.

The JSON-based data import from third parties into the net graphic system is designed to simplify the process and ensure that all required elements are correctly created and inserted. This ensures efficient and error-free data transfer.

## JSON Description (basic data structure)

```json
{
  "nodes": [],
  "trainrunsections": [],
  "trainruns": [],
  "resources": [],
  "metadata": {},
  "freeFloatingTexts": [],
  "labels": [],
  "labelGroups": [],
  "filterData": {}
}
```

- **nodes**: Represents the nodes in the Netzgrafik.
- **trainrunsections**: Contains the sections of trainruns.
- **trainruns**: Represents the trainruns in the Netzgrafik.
- **resources**: Contains an abstraction for resources related to the Netzgrafik (between nodes - edges) _not yet implemented_.
- **metadata**: Stores metadata information such as colors, train categories, etc.
- **freeFloatingTexts**: Contains any freely placed texts in the Netzgrafik, notes.
- **labels**: Represents labels associated with nodes or trainruns.
- **labelGroups**: Groups labels together for easier management and to classify the labels into trainrun labels, node labels and note labels,.
- **filterData**: Contains data related to filtering the Netzgrafik.

This is the basic data structure to represent the various elements in a JSON description. You can populate each element with the specific data relevant to your scenario.

See also [DATA_MODEL.md : business orientated description](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/documentation/JSON_DATA/documentation/technical/DATA_MODEL.md#business-orientated-description)

---

### nodes

```json
"nodes": [
  {
    "id": 1,
    "betriebspunktName": "OL",
    "fullName": "Olten",
    "positionX": 832,
    "positionY": 32,
    "ports": [
      {
        "id": 0,
        "trainrunSectionId": 0,
        "positionIndex": 0,
        "positionAlignment": 1
      },
      {
        "id": 1,
        "trainrunSectionId": 1,
        "positionIndex": 0,
        "positionAlignment": 0
      },
      {
        "id": 2,
        "trainrunSectionId": 2,
        "positionIndex": 1,
        "positionAlignment": 0
      },
    ],
    "transitions": [
      {
        "id": 0,
        "port1Id": 1,
        "port2Id": 0,
        "isNonStopTransit": true
      }
    ],
    "connections": [
      {
        "id": 0,
        "port1Id": 2,
        "port2Id": 1,
      }
    ],
    "resourceId": 2,
    "perronkanten": 10,
    "connectionTime": 5,
    "trainrunCategoryHaltezeiten": { },
    "symmetryAxis": null,
    "warnings": null,
    "labelIds": []
  },
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **betriebspunktName**: Operation control point (OCP) : string
- **fullName**: The full name of the operation control point : string
- **positionX**: The X position - where the node is placed in the editor (map / horizontal position) : numeric
- **positionY**: The Y position - where the node is placed in the editor (map / vertical position) : numeric
- **ports** : The ports assigned to the node. (See also [node:port](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL.md#ports-alignment) : Array of ports
- **transitions** : The trainrun [transitions](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL.md) assigned to the node : Array of transitions
- **connections** : The trainrun connections in the node : Array of connections
- **resourceId**: Reference to the resourceId : numeric
- **perronkanten** : The number of platform (Perron) within the node : numeric
- **connectionTime** : The connection time in minute which the infrastructure requires to change the platform : numeric
- **trainrunCategoryHaltezeiten** : The stop time if the trainrun of product [A, B, C, D or IPV] have to do per default : trainrunCategoryHaltezeiten
- **symmetryAxis** : Deprecated : null
- **warnings**: If the business logic needs to notify the user about issues, a warning can be used in JSON format : Warning
- **labelIds**: Filterable labels assigned to the node are stored in this array of label identifiers : Array of numeric

<details>
<summary>
More details about ports
</summary>

```json
{
  "id": 0,
  "trainrunSectionId": 0,
  "positionIndex": 0,
  "positionAlignment": 1
}
```

- **id**: Technical identifier (key), must be unique : numeric
- **trainrunSectionId**: Reference to the trainrunsection assigned to the port : numeric
- **positionIndex**: Position index within the port alignment sorting: numeric
- **positionAlignment**: [Position aligment](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL.md#ports-alignment) - reference [0, 1, 2, 3] : numeric

</details>

<details>
<summary>
More details about transitions
</summary>

```json
{
  "id": 0,
  "port1Id": 0,
  "port2Id": 1,
  "isNonStopTransit": true
}
```

- **id**: Technical identifier (key), must be unique : numeric
- **port1Id**: Reference to the port from which the transition starts (port must be a member of the node) : numeric
- **port2Id**: Reference to the port to which the transition ends (port must be a member of the node): numeric
- **isNonStopTransit**: If set to true the train will not stop at this node, otherwise (default) the trains stops : boolean

</details>

<details>
<summary>
More details about connections
</summary>

```json
{
  "id": 0,
  "port1Id": 0,
  "port2Id": 1
}
```

- **id**: Technical identifier (key), must be unique : numeric
- **port1Id**: Reference to the port from which train made a connection to another (port must be a member of the node) : numeric
- **port2Id**: Reference to the port to which train made the connection to (port must be a member of the node): numeric

</details>

<details>
<summary>
More details about trainrunCategoryHaltezeiten
</summary>

```json
"trainrunCategoryHaltezeiten": {
  "HaltezeitA": {
    "no_halt": false,
    "haltezeit": 2
  },
  "HaltezeitB": {
    "no_halt": false,
    "haltezeit": 2
  },
  "HaltezeitC": {
    "no_halt": false,
    "haltezeit": 1
  },
  "HaltezeitD": {
    "no_halt": false,
    "haltezeit": 1
  },
  "HaltezeitIPV": {
    "no_halt": false,
    "haltezeit": 3
  },
  "HaltezeitUncategorized": {
    "no_halt": true,
    "haltezeit": 0
  }
},
```

- **id**: Technical identifier (key), must be unique : numeric
- **port1Id**: Reference to the port from which the transition starts (port must be a member of the node) : numeric
- **port1Id**: Reference to the port to which the transition ends (port must be a member of the node): numeric
- **isNonStopTransit**: If set to true the train will not stop at this node, otherwise (default) the trains stops : boolean

</details>

---

### trainrunsections

```json
"trainrunSections": [
  {
    "id": 0,
    "sourceNodeId": 0,
    "sourcePortId": 0,
    "targetNodeId": 1,
    "targetPortId": 0,
    "travelTime": { },
    "sourceDeparture": { },
    "sourceArrival": { },
    "targetDeparture": { },
    "targetArrival": { },
    "numberOfStops": 0,
    "trainrunId": 0,
    "resourceId": 0,
    "specificTrainrunSectionFrequencyId": null,
    "path": {
      "path": [ ],
      "textPositions": { }
    },
    "warnings": null
  },
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **sourceNodeId**: Reference to the node : numeric
- **sourcePortId**: Reference to the [node:port](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL.md#ports-alignment) : numeric
- **targetNodeId**: Reference to the node : numeric
- **targetPortId**: Reference to the [node:port](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL.md#ports-alignment) : numeric
- **travelTime**: The travel time and lock information : [TimeLock ](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#timelock)
- **sourceDeparture**: The departure time at source node in minute and lock information : [TimeLock ](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#timelock)
- **sourceArrival**: The arrival time at source node in minute and lock information : [TimeLock ](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#timelock)
- **targetDeparture**: The departure time at target node in minute and lock information : [TimeLock ](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#timelock)
- **targetArrival**: The arrival time at source node in minute and lock information : [TimeLock ](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#timelock)
- **numberOfStops**: The number of intermediate stops: numeric
- **trainrunId**: Reference to the trainrunId : numeric
- **resourceId**: Reference to the resourceId : numeric
- **specificTrainrunSectionFrequencyId**: Reference to the trainrun section frequency (not used)
- **path**: SVG path (coordinate) how to render the trainrun, cached : Path
- **warnings**: If the business logic needs to notify the user about issues, a warning can be used in JSON format : Warning

#### TimeLock

The timelock data stores information about the time (e.g., travel time, departure time, or arrival time) and can be accompanied by a lock indicator. The lock indicator is set to "true" if it should not be changed during transmission, and "false" if the time can be modified. Additionally, the timeFormatter can be configured, and when the Netzgrafik-Editor renders the time, it will be formatted according to the rules specified by the timeFormatter.

<details>
<summary>
More details about TimeLock
</summary>

```json
{
  "lock": true,
  "time": 15,
  "warning": null,
  "timeFormatter": null,
  "consecutiveTime": 1
}
```

- **lock**: Indicate whether the time is lock or not : boolean
- **time**: The time in minutes : numeric
- **warning**: If the business logic needs to notify the user about issues, a warning can be used in JSON format : Warning
- **timeFormatter**: If not null - the Netzgrafik-Editor renders the time, it will be formatted according to the rules specified by the timeFormatter
- **consecutiveTime**: The consecutive time in minutes - for travel time this will be ignored : numeric

#### timeFormatter

```json
  "timeFormatter": {
    "colorRef": null,
    "htmlStyle": "font-size: 10px;",
    "textWidth": 60,
    "stylePattern": "{{consecutiveTime}}.format(HH:mm) ➤"
  },
```

```typescript
export interface TimeFormatter {
  /*
    stylePattern : free text or special data access pattern or in any combination.
    supported special data access pattern [
    '{{consecutiveTime}}.format(HH:mm:ss)',
    '{{consecutiveTime}}.format(HH:mm)',
    '{{consecutiveTime}}',
    '{{time}}.format(HH:mm:ss)',
    '{{time}}.format(HH:mm)',
    '{{time}}'
    ]
  */
  colorRef: ColorRefType;
  stylePattern: string;
  textWidth: number; // default 20
  htmlStyle: string; // default '' - example 'font-size: 16px'- should not be used for coloring !!!
}

// TimeFormatter erweitert TimeLockDto (Zeitfelder) auf TrassenSection
export interface TimeLockDto {
  time: number;
  consecutiveTime: number;
  lock: boolean;
  warning: WarningDto;
  timeFormatter: TimeFormatter; // undefined or object
}
```

</details>

---

### trainrun

```json
  "trainruns": [
    {
      "id": 1,
      "name": "X",
      "categoryId": 1,
      "frequencyId": 3,
      "trainrunTimeCategoryId": 0,
      "labelIds": [],
      "direction": "round_trip"
    }
  ],
```

- **id**: Technical identifier (key), must be unique : numeric
- **name**: The name of the trainrun : string
- **categoryId**: Reference to the [trainrunCategories](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#metadata) : numeric
- **frequencyId**: Reference to the [trainrunFrequencies](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#metadata) : numeric
- **trainrunTimeCategoryId**: Reference to the [trainrunTimeCategories](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/technical/DATA_MODEL_JSON.md#metadata) : numeric
- **labelIds**: Filterable labels assigned to the node are stored in this array of label identifiers : Array of integer
- **direction**: Direction of the trainrun : Direction (enum value)

---

### metadata

```json
"metadata": {
  "netzgrafikColors": [],
  "trainrunCategories": [],
  "trainrunFrequencies": [],
  "trainrunTimeCategories": [],
  "analyticsSettings": {}
}
```

<details>
<summary>
netzgrafikColors: Represents the user defined colors which can be used in the Netzgrafik.
</summary>

```json
"netzgrafikColors": [
  {
    "id": 0,
    "colorRef": "GoldenColoring",
    "color": "#816756",
    "colorFocus": "#2F3A4C",
    "colorMuted": "#D5BE87",
    "colorRelated": " #ADA672",
    "colorDarkMode": "#ADA672",
    "colorDarkModeFocus": "#D5BE87",
    "colorDarkModeMuted": "#2F3A4C",
    "colorDarkModeRelated": "#816756"
  },
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **colorRef**: Must be unique : string
- **color**: HTML color (HEX) used when a trainrun is rendered : string
- **colorFocus**: HTML color (HEX) used when a trainrun is rendered as focused : string
- **colorMuted**: HTML color (HEX) used when a trainrun is rendered as muted : string
- **colorRelated**: HTML color (HEX) used when a trainrun is rendered as related to another : string
- **colorDarkMode**: HTML color (HEX) used when a trainrun is rendered (dark mode) : string
- **colorDarkModeFocus**: HTML color (HEX) used when a trainrun is rendered as focused (dark mode) : string
- **colorDarkModeMuted**: HTML color (HEX) used when a trainrun is rendered as muted (dark mode) : string
- **colorDarkModeRelated**: HTML color (HEX) used when a trainrun is rendered as related to another (dark mode) : string

The Netzgrafik Editor has some default implemented colors with unique predefined colorRefs. Each colorRef must be unique (key).
Therefore, those predefined colorRefs cannot be used for a user-specific netzgrafikColors declaration. The predefined colors are:

```
defaults: ColorRefType[] = ["EC", "IC", "IR", "RE", "S", "G", "GEX"]
```

For more detail have a look into the
[netzgrafikColoring.service.ts](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/src/app/services/data/netzgrafikColoring.service.ts#L473) and also [src/app/models/netzgrafikColor.model.ts](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/src/app/models/netzgrafikColor.model.ts)

</details>

<details>
<summary>
trainrunCategories: Contains the categories of train runs.
</summary>

```JSON
   "trainrunCategories": [
      {
        "id": 0,
        "name": "International",
        "order": 0,
        "colorRef": "GoldenColoring",
        "shortName": "EC",
        "fachCategory": "HaltezeitIPV",
        "sectionHeadway": 2,
        "nodeHeadwayStop": 2,
        "nodeHeadwayNonStop": 2,
        "minimalTurnaroundTime": 4
      },
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **name**: The full name of the trainrun categories : string
- **order**: The full position (sorting) of the trainrun categories in the list and as well used for the rendering order (heuristic) of the trainruns sorting : numeric
- **colorRef**: Reference to a colorRef : netzgrafikColors.colorRef : string
- **shortName**: The short name of the trainrun categories. This is rendered in the Netzgrafik as prefix to the trainrun name : string
- **fachCategory**: Reference to the fachCategory : string
- **sectionHeadway**: Temporal distance (headway) in minute, when a train is traveling through a section : numeric
- **nodeHeadwayStop**: Temporal distance (headway) in minute, when a train is stopping at a node (station) : numeric
- **nodeHeadwayNonStop**: Temporal distance (headway) in minute, when a train is not stopping at a node (station) : numeric

</details>

<details>
<summary>
trainrunFrequencies: Represents the frequencies at which trainruns operates.
</summary>

```json
"trainrunFrequencies": [
  {
    "id": 4,
    "name": "verkehrt zweistündlich (gerade)",
    "order": 0,
    "offset": 0,
    "frequency": 120,
    "shortName": "120",
    "linePatternRef": "120"
  },
  {
    "id": 5,
    "name": "verkehrt zweistündlich (ungerade)",
    "order": 0,
    "offset": 60,
    "frequency": 120,
    "shortName": "120+",
    "linePatternRef": "120"
  }
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **name**: The full name of the trainrun frequency : string
- **order**: The rendering order in the list : numeric
- **offset**: Frequency offset in minute - when the frequency start after midnight, e.g. 2h frequency can start at midnight (00:00 / even) or at (01:00 / odd) : numeric
- **frequency**: Frequency in minute : numeric
- **shortName**: Short name : string
- **linePatternRef**: Reference to the line rendering pattern: 1, 2, 3, 4 lines and as well used for dotted, ... : string

The defined line pattern which can be used are

```
LinePatternRefs {
  "15", // four lines ; unique indentifier
  "20", // three lines  ; unique indentifier
  "30", // ==== ; unique indentifier
  "60", // ----- ; unique indentifier
  "120", // -.-.-.  ; unique indentifier
}
```

The following figure illustrates the four-layer (level) approach. Start by drawing the background on layer 0, then add levels 1, 2, and 3. Choose the appropriate stroke width and stroke color. Finally, ensure that we always have level 0, which serves as the background event handling area for mouse hovering and clicks (selection). To ensure that mouse events are captured, the stroke opacity for level 0 is set to 0.001 when it is not visible. Rendering styling is controlled via trainrunsections.view.scss

![image](https://github.com/user-attachments/assets/f12d1fe4-cb30-4d9c-95f6-bbe026eae1c0)

See also, [TrainrunSectionsView::make4LayerTrainrunSectionLines](https://github.com/search?q=repo%3ASchweizerischeBundesbahnen/netzgrafik-editor-frontend%20make4LayerTrainrunSectionLines&type=code)

See also,
![image](https://github.com/user-attachments/assets/4f6c0bb7-aba0-4aab-a7ae-ebce421705ce)

</details>

<details>
<summary>
trainrunTimeCategories: Contains the time categories for trainruns, such as all weekdays, only weekend and so on.
</summary>

```json
"trainrunTimeCategories": [
  {
    "id": 0,
    "name": "verkehrt uneingeschränkt",
    "order": 0,
    "weekday": [
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "shortName": "7/24",
    "linePatternRef": "7/24",
    "dayTimeInterval": []
  },
  {
    "id": 1,
    "name": "verkehrt zur Hauptverkehrszeit",
    "order": 1,
    "weekday": [
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ],
    "shortName": "HVZ",
    "linePatternRef": "HVZ",
    "dayTimeInterval": [
      {
        "to": 420,
        "from": 360
      },
      {
        "to": 1140,
        "from": 960
      }
    ]
  }
]
```

- **id**: Technical identifier (key), must be unique : numeric
- **name**: The full name of the trainrun time category : string
- **order**: The rendering order in the list : numeric
- **weekday**: Weekdays when the trainrun is operated / Monday = 1, Tuesday = 2, ... , Sunday = 7 : array numeric
- **shortName** : Short name : string
- **linePatternRef**: Line pattern how to render the trainrun time category
- **dayTimeInterval**: can be empty : dayTimeIntervalElement - JSON

The defined line pattern which can be used are

```
LinePatternRefs {
  TimeCat7_24 = "7/24", // . . . ; unique indentifier
  TimeCatHVZ = "HVZ", // . : . : ; unique indentifier
  TimeZeitweise = "ZEITWEISE", // : - : - ; unique indentifier
}
```

Define the dayTimeIntervalElement

```json
{
  "to": 1140,
  "from": 960
}
```

- **from** : interval starts at time (include), in minute : numeric
- **to** : interval ends at time (include), in minute : numeric

See also,
![image](https://github.com/user-attachments/assets/4f6c0bb7-aba0-4aab-a7ae-ebce421705ce)

</details>

<details>
<summary>
analyticsSettings: Contains settings for analytics features, such as originDestination matrix.
</summary>

```JSON
"analyticsSettings": {
    "originDestinationSettings": {
        "connectionPenalty": 5
    },
}
```

- **connectionPenalty**: Cost to add for each connection, in minute : numeric

</details>

---

### freeFloatingTexts

```JSON
"freeFloatingTexts": [
  {
    "id": 1,
    "x": 1147,
    "y": 267,
    "width": 192,
    "height": 64,
    "title": "Titel",
    "text": "Text",
    "backgroundColor": "#ffffff",
    "textColor": "#000000",
    "labelIds": []
  }
],
```

- **id**: Technical identifier (key), must be unique : numeric
- **x**: The X position - where the node is placed in the editor (map / horizontal position) : numeric
- **y**: The Y position - where the node is placed in the editor (map / vertical position) : numeric
- **width**: The width of the text box : numeric
- **height**: The height of the text box : numeric
- **title**: The title of the node (freeFloatingTexts) : string
- **text**: The text (description) of the node : string
- **backgroundColor**: HTML color as HEX for the background: string
- **textColor**: HTML color as HEX for the text: string
- **labelIds**: Filterable labels assigned to the node are stored in this array of label identifiers : Array of integer
