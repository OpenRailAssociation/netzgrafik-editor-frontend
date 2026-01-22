## Trainruns

### Create new trainrun

With the help of the left mouse button and keyboard you can create or modify any trainrun.

- If no trainrun is selected - you can create a new trainrun just by graphical drawing.
- If a trainrun is selected you can modify a trainrun, including extending the trainrun journey
  path (route), reroute the path, delete a trainrun or just a trainrun section. Further you can
  change the times such as departure time, arrival time, journey time or you can further modify
  the trainrun category and name.

When a new trainrun gets created the system opens a dialog window where you can enter all
information about the newly created trainrun, such as trainrun category and name. Then click outside
the window or press `ESC` to close the dialog window.

> - If you like to (re)open the dialog windows just click on the trainrun name in the editor or

    click any number (time). The dialog window is displayed again with the clicked data input field
    in focus.

> - If you click on the trainrun - it gets selected and you can modify it.
> - Click for a second time the Perlenkette gets opened.

[29-01-2024-005-start-creating_trainrun.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/bc23f079-3aa6-4725-af6f-da4a53627ca3)

For more details have a look into [create and modifiy trainrun](CREATE_TRAINRUN.md).

#### Create new trainrun section - step by step

To create a new train or adding new trainrun section to an existing trainrun, proceed as follows:

- Move with the mouse pointer to the (inner) node: Press the `left mouse button` on the inner node
  from which you want to start the trainrun section.
- Hold pressed the `left mouse button` and drag the line to the other node. The line displays visually
  the trainrun section you want to create.
- Configure the train route: Give the new train an appropriate name and specify the necessary
  details, such as train number or other relevant information.

[2024-01-25-Create_New_Trainrun.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/99823c8a-b48a-427e-a981-dc9652fde7a1)

> **Note:** Importantly, you don't have to select a train route to create a new trainrun -
> otherwise, you modify the selected trainrun

##### Travel time estimator (Default)

The application has a travel time pre-setting or heuristic implemented which
allows for an automated determination of travel times when drawing a new section.
Currently, following different heuristics are available:

- The **default method** (heuristic) assumes a constant travel time per section, with a default setting of 1 minute per section.
  This means that regardless of the distance or other factors, each section has a fixed travel time of 1 minute.
  This heuristic can be helpful as it generates obviously unusable travel times, prompting the user to address the travel time. The
  1 minute is very clear that this time has to be manually adapted.

- A more complex method (heuristic) can be set to **derive the travel time from existing ones**. The travel time heuristic
  searches for other trains of the same category on the section. If there are other trains, the longest travel
  time is adopted for the newly inserted section. If not, the heuristic searches for other trains, regardless of their category.
  If other trains are found, the maximum travel time is used; otherwise, the default is set to 1 minute.

The heuristic can be adjusted under Settings - Editor - Travel Time Pre-setting (heuristic).
The setting is user-specific and is stored in the user's profile (browser).

### Rerouting trainrun sections

To reroute a train, follow these steps:

- Select the train to be rerouted: Use the left mouse button and click to select the train that you
  want to reroute.
- Drag and drop sections on the node: After selecting the train, you can rearrange sections of the
  train by dragging and dropping the small pins (circle) on the nodes. This allows you to reassign
  sections to other nodes.
- Redirect train sections: If you want to redirect (reroute) two sections, you can easily do so by
  clicking and holding the left mouse button on the hexagon button on the node. Then, drag and drop
  the hexagon button, and both train sections will move together. Drag the sections to a different
  node to reroute them.
  > If you drag the hexagon button outside the node it generates an intermediate stop if there was a
  > stopping transition or it just removed the non-stop transition. For both cases it reroutes the
  > trainrun by removing the node alignment where the hexagon/transition was.

[2024-1-25-Rerouting_extend_remove_trainrunsections-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/d697594c-57a8-4159-b44f-8a9f804f297f)

[2024-1-25-Rerouting_trainrunsections-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/9368c34c-fddf-4698-abf6-e07afba5a1d6)

### Remove Nodes // Add Intermediate Stop Nodes

Without deleting trainrun sections (undock transitions), resp. create node to split trainrun section into two
and dock to the new intermediate stop node in between.

#### Remove a Node

- **What happens**  
  Hover the mouse cursor over a node and press `s`. The node will be deleted.
- **Result**  
  All trainrun sections that were docked to this node will be undocked. They are no longer connected and become "free-floating."

#### Add an Intermediate Stop Node (Split & Dock)

- **How to select**
  - Hold the left mouse button to select multiple nodes.
  - Alternatively, use **Shift + mouse click** for multi-selection.
  - You can also select trainrun sections by drawing a selection box over their names.

- **What happens after selection**  
  When at least one trainrun section is selected and you press `s`:
  - A new intermediate stop node is created.
  - The selected trainrun sections are docked to this new node.
  - The trainrun sections are split into segments aligned with the new intermediate stop node.

### Delete a trainrun section

To delete a trainrun section, process as follows:

- Click the trainrun to modify (select the trainrun)
- Move with the mouse pointer to one of the two pins (cricle) where the trainrun section is aligned
  to the node
- Press `left mouse button` and drag the pin (trainrun section). Instead of reassign to another or
  same node, just release it outside the node

### Toggle stop / non-stop at node (trainrun transition)

To switch a train from a stop to a non-stop at a node, follow these steps:

- Select the train: Ensure that the train you want to modify is selected. You can do this by
  left-clicking on the train.
- Access trainrun transitions: Locate the hexagon button within the node representation. This button
  signifies trainrun transitions (stop/non-stop).

[2024-01-25-Toogle_Stop_NonStop_trainrun_at_node.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/8a72350c-ed19-4395-8183-c33dfe824c5a)

### Split / Combine two trainruns and merge Netzgrafik

For more details have a look into

- [Split/Combine two trainruns](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/Split_Combine_Trainruns.md)
- [Merge Netzgrafik](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/Merge_Netzgrafik.md)

## Special cases

### One-way trainruns (Direction)

By default, a trainrun is a round-trip schedule for a defined path. However, some situations need to deal with only "one-way" trainruns. For that, a trainrun can be modified to only show the journey for a single direction. The direction of the trainrun is then stored in its attribute `Direction`, that is either one of the following value:

- `"round_trip"`: trainrun represents `A - B - C`
- `"one_way"`: trainrun represents `A -> B -> C` or `A <- B <- C` (same value of `Direction` attribute, but the trainrun (so the nodes path) is inverted)

The resulting trainrun then behave then differently with the rest of the features of NGE (space-time chart, origin-destination matrix, node occupancy...).

[2025-08-11-Update_Trainrun_Direction.webm](documentation/animated_images/2025-08-11-Update_Trainrun_Direction.webm)

#### Minimum dwell time is used for one‑way train‑run staging/unstaging
When the user opens the Streckengraphik (graphical timetable) and requests the track occupier at nodes, all trainruns that start or end at a node are shown as occupying one track (platform) for the entire turnaround.
However, one‑way trainruns do not have a turnaround concept. Therefore, we must define the time before departure and after arrival at the first and last node of the trainrun.
This time is used for node‑track occupancy.

> The current version of the Netzgrafik Editor uses the minimum dwell time for staging and unstaging at the beginning and end of the trainrun.

### Trainrun path with "holes" (missing sections)

![image](https://github.com/user-attachments/assets/d87b842c-7696-4e81-aa78-75cc966b5306)
_Example Netzgrafik with missing sections (See the cargo trainrun GTwo_Part_trainrun)_

When creating a trainrun, the trairnun path should connect all nodes from start to destination using trainrun sections.
However, it can happen during the creation that not all trainrun sections have been drawn in the meantime.
Gaps may occur along the trainrun path where at least one trainrun section is missing.
These “holes” usually occur if the trainrun path has not yet been drawn completely or correctly.
For example, a trainrun path could look like this with a "hole" in the middle,

A - B - C ---- (missing section) ---- E - F - G

The trainrun section between C and E is missing here. However, these gaps can also occur if a partial cancelation is made for a trainrun.

![image](https://github.com/user-attachments/assets/5d1ef657-e421-41ff-ae57-622eee82f295)
_Graphical timetable._

In each of these cases, the trainrun has at least two parts, e.g. [(A B), (A C)] and [(E F)(F G)].
In this case, the trainrun is interpreted as two separate trainruns.
The Netzgrafik has no information about whether the missing part could be closed between C - E, C - D - E or
another possible variant, therefore the assumption that there is an independent trainrun for each trainrun part is
the best assumption. This avoids many new problems.
