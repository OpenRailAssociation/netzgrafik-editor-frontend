## Advanced editing short-cuts

Users can perform advanced editing operation short-cuts such as copy `ctrl`+`c`, paste `ctrl`+`v`,
duplicate `ctrl`+`d`, delete `delete` and undo `ctrl`+`z` in multiple steps - either using the
standard `ctrl`+`z` key command or with help of the version history. These editing functions make it
easier to manage and edit complex network structures.

> Users don't need to explicitly save the latest changes. The system saves it automatically. There is
> therefore no shortcut for saving changes.

### Short-cuts

|                                                  Keyboard                                                  |                                                                                            description                                                                                             |
|:----------------------------------------------------------------------------------------------------------:|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
|                                                                                                            |                                                                                                                                                                                                    |
|                                                  `delete`                                                  |                                                                          Delete nodes, comments, and selected trainruns.                                                                           |
|                                             `ctrl`+`d` / `insert`                                              |                                   Duplicate nodes, comments, and selected trainruns (if multiple nodes are selected, trains including nodes will be duplicated).                                   |
|                                                  `insert`                                                  |                                                                         Add new nodes under the mouse on the drawing area.                                                                         |
|                                                  `escape`                                                  |                                                         Select trainruns / In multi-node move mode, all selected nodes will be unselected.                                                         |
| `shift` + `left mouse button` pressed and move (or alternatively with the `right mouse button` pressed and move) |                                               Multi-select nodes and notes for subsequent moving or delete all selected elements by using `Delete`.                                                |
|                                                   `ctrl`+`z`                                                   |                                                                                Undo - Reverse the previous action.                                                                                 |
|                                                   `ctrl`+`c`                                                   | Copy the currently visible trainruns. The copied content remains in the browser's memory/cache and can be pasted into different variants (even after closing the browser, the data remains saved). |
|                                                   `ctrl`+`v`                                                   |                                                                                    Paste the copied trainruns.                                                                                     |
|                                                   `ctrl`+`a`                                                   |                                                                                            Select all.                                                                                             |

### Duplicate

To duplicate one or many elements - use `shift` + `left` mouse button pressed* to select several
elements and press `ctrl`+`d`.

If more than one node is selected, all train sections that are
connected to two selected nodes are also duplicated. If further notes are selected, the notes are
duplicated in the same way as the nodes.

> If in the menu the *Knoten-Positionierungswerkzeug* is activated, you can *multi-select* nodes and
> notes by clicking. If you use `shift` + `right mouse button pressed`

#### Duplicate trainrun

To duplicate a train in the project, follow these steps:

- Select the train: Use the left mouse click to select the train that you want to duplicate.
- Duplicate the train: Once the train is selected, press `ctrl`+`d` on your keyboard to duplicate
  it. This action will create an identical copy of the selected train.

  > There are alternative editing path to process duplication: Use the copy-paste idea: Select the
  train und press `ctrl`+`c` then `ctrl`+`v`

- Edit the train name: Click on the train name with the left mouse button, and a dialog window will
  open, allowing you to edit the train's details. Make the necessary changes to the train name or
  any other relevant information.

[2024-1-25-Duplicate_Trainrun_ctr_d.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/d04b45e1-c032-4449-a5aa-d7a8f27b43ea)

> **Optional:** Edit the train in the [Perlenkette](#Perlenkette)

#### Duplicate nodes

To duplicate a node, ensure there is no trainrun selected. Move with the mouse pointer over the node
to duplicate and press `ctrl`+`d`.

#### Duplicate notes

To duplicate a note, ensure there is no trainrun selected. Move with the mouse pointer over the note
to duplicate and press `ctrl`+`d`.

### Delete

To delete one or many elements - use `shift` + `left mouse button pressed` to select several elements
and press `delete`.

#### Delete trainrun

To delete a train in the project, follow these steps:

- Select the train: Use the left mouse click to select the train that you want to delete.
- Delete the train: Once the train is selected, press 'delete' on your keyboard to delete
  it. This action will create an identical copy of the selected train.

  > There are alternative editing path to process duplication: Use the copy-paste idea: Select
  the train and press `ctrl`+`c` then `ctrl`+`v`.

#### Delete nodes

To delete a node, ensure there is no trainrun selected. Move with the mouse pointer over the node
to delete and press `delete`. Deleting a node causes all train sections connected to the node to be deleted.

#### Delete notes

To delete a note, ensure there is no trainrun selected. Move with the mouse pointer over the note
to delete and press `delete`.
