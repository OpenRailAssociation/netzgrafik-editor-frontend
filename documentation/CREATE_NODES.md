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

|                  |                      BP                      |                     Bahnhof                      |   Kategorie    |    Region     |              Fahrgastwechselzeit_IPV               |               Fahrgastwechselzeit_A                |               Fahrgastwechselzeit_B                |               Fahrgastwechselzeit_C                |               Fahrgastwechselzeit_D                |      ZAZ      |           Umsteigezeit           |              Labels               |         X         |          Y          |                            Erstellen                            |
| :--------------: | :------------------------------------------: | :----------------------------------------------: | :------------: | :-----------: | :------------------------------------------------: | :------------------------------------------------: | :------------------------------------------------: | :------------------------------------------------: | :------------------------------------------------: | :-----------: | :------------------------------: | :-------------------------------: | :---------------: | :-----------------: | :-------------------------------------------------------------: |
|     Datatype     |                    string                    |                      string                      |     string     |   nummeric    |                      nummeric                      |                      nummeric                      |                      nummeric                      |                      nummeric                      |                      nummeric                      |   nummeric    |             nummeric             |             nummeric              |     nummeric      |      nummeric       |                          'JA' or empty                          |
|   Description    |                      id                      |                    full name                     | category label | region number | if <= 0 -> non stop, otherwise > default stop time | if <= 0 -> non stop, otherwise > default stop time | if <= 0 -> non stop, otherwise > default stop time | if <= 0 -> non stop, otherwise > default stop time | if <= 0 -> non stop, otherwise > default stop time | no implemened | min. connectiontime - Default: 2 | comma separated filterable labels | vertical position | horizontal position | if 'JA' missing nodes gets created, otherwise just updated (ID) |
| More information | this is a unique identifier <br/>(non-empty) | full name of the station (node) <br/>(non-empty) | empty allowed  | empty allowed |                   empty allowed                    |                   empty allowed                    |                   empty allowed                    |                   empty allowed                    |                   empty allowed                    | empty allowed |          empty allowed           |           empty allowed           |   empty allowed   |    empty allowed    |                          empty allowed                          |

**category label:** If the node gets created or updated the category labels gets added as filterable
label. The label template ist "Kategorie:" + value. Comma separated values allows to add more than
one category label.

**region number:** If the node gets created or updated the region number gets added as filterable
label. The label template ist "Region:" + value. Comma separated values allows to add more than one
region label.

</details>

<details>
<summary> Example data  
</summary>

| BP   | Bahnhof           | Region | Kategorie | Fahrgastwechselzeit_IPV | Fahrgastwechselzeit_A | Fahrgastwechselzeit_B | Fahrgastwechselzeit_C | Fahrgastwechselzeit_D | Umsteigezeit | ZAZ | Labels | Erstellen | X            | Y            |
| ---- | ----------------- | ------ | --------- | ----------------------- | --------------------- | --------------------- | --------------------- | --------------------- | ------------ | --- | ------ | --------- | ------------ | ------------ |
| AA   | Aarau             | Mitte  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            | 0.2 | SBB    | JA        | -209.4991625 | -427.021373  |
| GD   | Arth-Goldau       | Sud    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 951.9866035  | 758.834056   |
| BEL  | Bellinzona        | Sud    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 2121.053433  | 3728.103892  |
| BR   | Brig              | Ouest  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | -329.3652    | 3328.39752   |
| BUE  | Bülach            | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 898.8887195  | -904.009981  |
| CHI  | Chiasso           | Sud    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 7            |     |        | JA        | 2150.55564   | 5000         |
| CH   | Chur              | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 3235.226062  | 1397.129247  |
| FRI  | Fribourg/Freiburg | Ouest  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | -2286.192724 | 1637.608378  |
| GE   | Genève            | Ouest  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | -4663.358198 | 3689.447021  |
| GEAP | Genève aéroport   | Ouest  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 1            |     |        | JA        | -4733.658091 | 3610.022432  |
| IO   | Interlaken Ost    | Mitte  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 5            |     |        | JA        | -656.2338255 | 2058.391723  |
| LQ   | Landquart         | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 3283.056782  | 995.1229965  |
| LG   | Lugano            | Sud    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 1939.473284  | 4397.116645  |
| OL   | Olten             | Mitte  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 5            |     |        | JA        | -538.742579  | -286.602732  |
| SG   | St. Gallen        | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 5            |     |        | JA        | 2818.572081  | -589.3046175 |
| TH   | Thun              | Mitte  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | -1173.572842 | 1807.484374  |
| VI   | Visp              | Ouest  | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | -578.900898  | 3418.974947  |
| WIL  | Wil               | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 2060.435379  | -709.0873575 |
| W    | Winterthur        | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 1330.339474  | -828.050963  |
| ZG   | Zug               | Ost    | 2         | 2                       | 2                     | 2                     | 2                     | 2                     | 4            |     |        | JA        | 866.6159235  | 323.4007965  |
| ZFH  | Zürich Flughafen  | Ost    | 2         | 3                       | 3                     | 3                     | 3                     | 3                     | 4            |     |        | JA        | 962.4904855  | -647.2111605 |

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
