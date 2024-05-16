## Trainruns

### Create new trainrun

With the help of the left mouse button and keyboard you can create or modify any trainrun.

- If no trainrun is selected - you can create a new trainrun just by graphical drawing.
- If a trainrun is selected you can modify a trainrun, including extending the trainrun journey
  path (route), reroute the path, delete a trainrun or just a trainrun section. Further you can
  change the times such as departure time, arrival time, journey time or you can further modify
  the trainrun category and name.

When a new trainrun gets created the system opens a dialog window where you can enter all
information about the new created trainrun, such a trainrun category and name. Then click outside
the window or press 'ESC' to close the dialog window.

> - If you like to (re)open the dialog windows just click on the trainrun name in the editor or
    click any number (time). The dialog window is displayed again with the clicked data input field
    in focus.
> - If you click on the trainrun - its gets selected and you can modify it.
> - Click for a second time the Perlenkette gets opened.

[29-01-2024-005-start-creating_trainrun.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/bc23f079-3aa6-4725-af6f-da4a53627ca3)

For mor details have a look into [create and modifiy trainrun](CREATE_TRAINRUN.md).

#### Create new trainrun section - step by step

To create a new train or adding new trainrun section to an existing trainrun, proceed as follows:

- Move with the mouse pointer to the (inner) node: Press the left mouse button on the inner node
  from which you want to start the trainrun section.
- Hold pressed the left mouse button and drag the line to the other node. The line displays visually
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
1 minute is very clear that this time has to manually adapted. 

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
  stopping transition or it just removed the non-stop transition. For both cases it reroutes the
  trainrun by removing the node alginment where the hexagon/transition was.

[2024-1-25-Rerouting_extend_remove_trainrunsections-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/d697594c-57a8-4159-b44f-8a9f804f297f)

[2024-1-25-Rerouting_trainrunsections-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/9368c34c-fddf-4698-abf6-e07afba5a1d6)

### Delete a trainrun section

To delete a trainrun section, process as follows:

- Click the trainrun to modify (select the trainrun)
- Move with the mouse pointer to one of the two pins (cricle) where the trainrun section is aligned
  to the node
- Press left mouse button and drag the pin (trainrun section). Instead of reassign to another or
  same node, just release it outside the node

### Toggle stop / non-stop at node (trainrun transition)

To switch a train from a stop to a non-stop at a node, follow these steps:

- Select the train: Ensure that the train you want to modify is selected. You can do this by
  left-clicking on the train.
- Access trainrun transitions: Locate the hexagon button within the node representation. This button
  signifies trainrun transitions (stop/non-stop).

[2024-01-25-Toogle_Stop_NonStop_trainrun_at_node.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/8a72350c-ed19-4395-8183-c33dfe824c5a)

### Split / Combine two trainruns 

#### Split two trainruns 

To split a train into two separate ones, you first have to select the train. Then you navigate to the node where you like to split the trainrun. Inside the node
the trainrun has to have a transition. Press CTRL and click with the mouse the "stop / non-stop toggle button". The trainrun gets split into two trains.

[chrome-capture-2024-3-27.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/10423646/8acabf0e-fdb1-445b-af40-1ec4b6875c0c)


#### Combine two trainruns 

To combine two trainruns, you have to select one of the two trains. Then you have to navigate to the node where the trainrun ends (or starts). Now you can draw
the new transition similar to creating a connection - but you have to press **CTRL key** and it must be hold pressed as long you are drawing a new transition. 
Once you finish drawing the new transition, the both trains will be combined to one single trainrun.
Please have as well a look into [Create Connections](CREATE_CONNECTIONS.md). 

[chrome-capture-2024-3-27 (1).webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/10423646/526408d6-0d22-4cf7-ada7-9f45442aab8e)


#### Merge two indepandant Netzgrafik

To merge two Netzgrafik, you can use the split/combine technique. For example, if you have a Netzgrafik for the eastern part of Switzerland and one for the western part, you can merge the western into the eastern part by using copy-paste and trainrun combine techniques. First, copy the western part (all trains that need to be integrated into the eastern part). Then, insert the copied trainruns and nodes into the eastern part. After inserting, the resulting Netzgrafik will have all trainruns included, but the eastern and western parts of the trainruns are not yet combined. The eastern and western trainrun parts are still independent trainruns. Now, use the combine method to connect the trai runs. Once all trainruns are combined, the resulting Netzgrafik will be the merged one.

To merge two independent Netzgrafik, you can follow these steps:

- Identify the two Netzgrafik that you want to merge.
- Determine the trains and nodes that you want to combine.
- (Optional) Create a new variant.
- Copy the necessary elements from one Netzgrafik and paste them into the other Netzgrafik.
- As long as complete trainruns are copied, i.e. including all trainrun sections from start to destination, there is no need to merge trainruns. If the Netzgrafiks to be merged consists of regions (or partial corridors) 
  or just trainrun sections that actually represent partial trainrun , these must be merged manually using the Combine function at the nodes where the parts of the trainrun meet.
 
By following these steps, you can successfully merge two independent Netzgrafik.

[Merge_East_West_Trainruns.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/10423646/74277415-b522-4dc3-b2da-2f93e7fb5411)


