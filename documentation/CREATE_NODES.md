## Nodes

### Create new nodes

Whenever you need to create a new node. You should follow these steps:

- Activate the Topology Editor from the menu bar.
- Click on the desired location in the main area of the Netzgrafik-Editor, where you want to add
  the new node.
- A new node will be created, and the node editor window will open on the right-hand side.
- In the node editor window, you can edit all the information about the newly created node.

[29-01-2024-005-create_nodes.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/8ba6957c-de8e-467c-b7ae-c71b451d014e)

### Import nodes from a semicolon-separate-value file (CSV)

Nodes can be imported using a predefined **semicolon-separated file** (CSV). This allows
creating very quickly the required nodes and the defaults used for planning. In addition to node
properties, such as default stopping times (per trainrun type), node positions can also be imported
so that the layout comes directly from the import.

[29-01-2024-004-import_basedata.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/93196b1b-31d0-4993-a0eb-7ffb7689bed6)

<details>
<summary>Import CSV interface description
</summary>

|                  |          StationCode          |             StationName              |    Category    |    Region     |             DwellTime_IPV             |     StopFlag_IPV      |             DwellTime_A             |      StopFlag_A       |             DwellTime_B             |      StopFlag_B       |             DwellTime_C             |      StopFlag_C       |             DwellTime_D             |      StopFlag_D       |    BufferTime     |           TransferTime            |              Labels               |       XCoord        |      YCoord       |                            Create                            |
| :--------------: | :---------------------------: | :----------------------------------: | :------------: | :-----------: | :-----------------------------------: | :-------------------: | :---------------------------------: | :-------------------: | :---------------------------------: | :-------------------: | :---------------------------------: | :-------------------: | :---------------------------------: | :-------------------: | :---------------: | :-------------------------------: | :-------------------------------: | :-----------------: | :---------------: | :----------------------------------------------------------: |
|     Datatype     |            string             |                string                |     string     |    string     |                numeric                |   numeric (0 or 1)    |               numeric               |   numeric (0 or 1)    |               numeric               |   numeric (0 or 1)    |               numeric               |   numeric (0 or 1)    |               numeric               |   numeric (0 or 1)    |      numeric      |              numeric              |              string               |       numeric       |      numeric      |                          1 or empty                          |
|   Description    |              id               |              full name               | category label | region label  | dwell time for IPV category (minutes) | 1 = stop, 0 = no stop | dwell time for A category (minutes) | 1 = stop, 0 = no stop | dwell time for B category (minutes) | 1 = stop, 0 = no stop | dwell time for C category (minutes) | 1 = stop, 0 = no stop | dwell time for D category (minutes) | 1 = stop, 0 = no stop | buffer time (ZAZ) | min. connection time - Default: 2 | comma-separated filterable labels | horizontal position | vertical position | if 1 missing nodes gets created, otherwise just updated (ID) |
| More information | unique identifier (non-empty) | full name of the station (non-empty) | empty allowed  | empty allowed |             empty allowed             |     empty allowed     |            empty allowed            |     empty allowed     |            empty allowed            |     empty allowed     |            empty allowed            |     empty allowed     |            empty allowed            |     empty allowed     |   empty allowed   |           empty allowed           |           empty allowed           |    empty allowed    |   empty allowed   |                        empty allowed                         |

**Validation:** The importer rejects CSV files with missing or unknown columns. All 20 columns listed above must be present in this exact order.

**category label:** If the node gets created or updated the category labels get added as filterable
label. The label template is "Kategorie:" + value. Comma-separated values allow adding more than
one category label.

**region label:** If the node gets created or updated the region label gets added as filterable
label. The label template is "Region:" + value. Comma-separated values allow adding more than one
region label.

**StopFlags:** Must be numeric booleans — `1` = stop, `0` = no stop.

**Labels:** Comma-separated list, e.g. `"SBB,Kanton TI"`.

</details>

<details>
<summary> Example data  
</summary>

| StationCode | StationName       | Category | Region | DwellTime_IPV | StopFlag_IPV | DwellTime_A | StopFlag_A | DwellTime_B | StopFlag_B | DwellTime_C | StopFlag_C | DwellTime_D | StopFlag_D | BufferTime | TransferTime | Labels | XCoord       | YCoord       | Create |
| ----------- | ----------------- | -------- | ------ | ------------- | ------------ | ----------- | ---------- | ----------- | ---------- | ----------- | ---------- | ----------- | ---------- | ---------- | ------------ | ------ | ------------ | ------------ | ------ |
| AA          | Aarau             | 2        | Mitte  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          | 0.2        | 4            | SBB    | -209.4991625 | -427.021373  | 1      |
| GD          | Arth-Goldau       | 2        | Sud    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 951.9866035  | 758.834056   | 1      |
| BEL         | Bellinzona        | 2        | Sud    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 2121.053433  | 3728.103892  | 1      |
| BR          | Brig              | 2        | Ouest  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | -329.3652    | 3328.39752   | 1      |
| BUE         | Bülach            | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 898.8887195  | -904.009981  | 1      |
| CHI         | Chiasso           | 2        | Sud    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 7            |        | 2150.55564   | 5000         | 1      |
| CH          | Chur              | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 3235.226062  | 1397.129247  | 1      |
| FRI         | Fribourg/Freiburg | 2        | Ouest  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | -2286.192724 | 1637.608378  | 1      |
| GE          | Genève            | 2        | Ouest  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | -4663.358198 | 3689.447021  | 1      |
| GEAP        | Genève aéroport   | 2        | Ouest  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 1            |        | -4733.658091 | 3610.022432  | 1      |
| IO          | Interlaken Ost    | 2        | Mitte  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 5            |        | -656.2338255 | 2058.391723  | 1      |
| LQ          | Landquart         | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 3283.056782  | 995.1229965  | 1      |
| LG          | Lugano            | 2        | Sud    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 1939.473284  | 4397.116645  | 1      |
| OL          | Olten             | 2        | Mitte  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 5            |        | -538.742579  | -286.602732  | 1      |
| SG          | St. Gallen        | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 5            |        | 2818.572081  | -589.3046175 | 1      |
| TH          | Thun              | 2        | Mitte  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | -1173.572842 | 1807.484374  | 1      |
| VI          | Visp              | 2        | Ouest  | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | -578.900898  | 3418.974947  | 1      |
| WIL         | Wil               | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 2060.435379  | -709.0873575 | 1      |
| W           | Winterthur        | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 1330.339474  | -828.050963  | 1      |
| ZG          | Zug               | 2        | Ost    | 2             | 1            | 2           | 1          | 2           | 1          | 2           | 1          | 2           | 1          |            | 4            |        | 866.6159235  | 323.4007965  | 1      |
| ZFH         | Zürich Flughafen  | 2        | Ost    | 3             | 1            | 3           | 1          | 3           | 1          | 3           | 1          | 3           | 1          |            | 4            |        | 962.4904855  | -647.2111605 | 1      |

[Demo base data CSV file](29-01-2024-004-Stammdaten_importieren.csv)

</details>

### Move nodes

When one or more node(s) is/are repositioned (moved), the edge paths of all train segments at the
node are redrawn using a heuristic to minimize the number of overlapping edges. The Netzgrafik
recalculates the routing layout and results in a new well aligned readable graphical layout.

If you want to move a node process as follows:

- Move the mouse pointer to the node of interest
- As soon as the mouse pointer is over a node on the left hand side there will be a move symbol
  displayed. Move with the mouse pointer over this appeared symbol and press the left mouse button.
  (You can as well press the left mouse button over the node short name. This behaves equal to the
  symbol.)
- As long as the left mouse button is pressed you can move the node by just drag-and-drop.

#### Multi-select nodes

When you use the `left mouse button` pressed and drag a box - you can select multiple nodes. Once you have them selected you can drag (move) the nodes like a single one but now as a group.

[chrome-capture-2025-11-21.webm](https://github.com/user-attachments/assets/9ddc0104-4e11-4b09-bfcc-e3197f793de6)

#### Trainrun sorting heuristics

##### Single trainrun

This example shows how a trainrun is aligned to a node. The outgoing/incoming edge (trainrun
sections) depends on the node position to where the trainrun section is aligned to.

[29-01-2024-006-move-nodes-reroute_trainrun.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/9ffb18c9-3f47-4bec-b7da-6368037b6a5f)

<a id="MultipleTrainruns"></a>

##### Multiple trainruns outgoing/ingoing ports order (positions)

The outgoing/incoming edge alignment depends strongly on the position of the node.

If two or more trainrun have at least one identical node (start/end does not matter), the
trainrun are sorted according to the position of the branching node - from top to bottom or
from left to right or vice versa.

If two or more trainrun have the same neighbouring nodes, they are sorted by trainrun
category pre-defined order and trainrun name. If the category pre-defined order and trainrun name
are the same, they are further sorted according to the order of the drawing - first drawn, first
aligned.

> **Sorting heuristic**
>
> - Position Alignment (Top > Bottom > Left > Right)
> - Left - Right | Top - Down
> - Category short name (predefined order)
> - Trainrun name (alphabetically)
> - Trainrun (drawing order)
> - Trainrun section (drawing order)

[29-01-2024-006-move-nodes-reroute_trainrun-big.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/525545e1-7097-4187-8424-a3ae68b8985f)

##### Inserting and deleting of trainruns

Inserting and deleting trainrun sections affects the pin orders (edge ordering) and the node size
(height, width).

[2024-1-25-Move_nodes_reoute_notes_ports.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/96e6492d-1c71-4e38-838c-3ce51c80747a)
