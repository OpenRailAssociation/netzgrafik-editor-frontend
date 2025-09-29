## Filters

> In the Netzgrafik-Editor, the "What You See Is What You Get" principle applies.

This means that everything you have displayed will be drawn, analyzed, and can be edited.
Therefore, the filtering function plays a crucial role. It offers a wide range of possibilities,
from simple filtering to very complex and user-specific settings, allowing you to create complex
views.

### Basic filtering

To open the filter, click either on the filter symbol in the sidebar on the left or at the bottom
center in the menu bar. This will open the filter sidebar on the left side.
Here, you can adjust the filter settings. Any changes made to the filter will immediately affect the
Netzgrafik or graphic timetable (Streckengrafik). When filters are active, the filter symbol
will be highlighted in red.

If you want to temporarily reset the filtering, click again on the filter symbol at the bottom of
the menu bar. The filter symbol will display an "x," indicating that the filtering is temporarily
disabled. Clicking again will reactivate the filter.

To completely reset the filter, click on "Reset Filter" in the filter sidebar.

[2024-1-25-Filtering-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/60666fab-3ce3-4b73-b312-5bd28a1caee8)

To filter trains based on the criteria of train category, frequency, peak-hour service, and off-peak
service, you can proceed as follows:

- Train category filtering: Determine the desired train category, such as regional trains, intercity
  trains, or freight trains. Filter the trains according to this category to display only the
  desired trains.

- Frequency filtering: If you want to view trains with a specific frequency, specify it. For
  example, you can filter for trains that run every half hour, hourly, or every two hours.

- Service during specific periods: Filter the trains according to specific times, such as peak
  hours, off-peak hours, or irregular service. This allows you to display trains that operate only
  during specific time periods.

### Filterable labels

Users can add user-defined labels to trains, notes, and nodes.
These labels, also known as filterable labels, can be used to create custom filters based on
user-specific criteria.

Filterable labels can be grouped and sorted, making it easy to create new filter groups.
Within a filter group, such as train category or frequency, complex filters can be quickly created.

To do this, you need to switch to the editing tool and navigate to the filterable labels,
specifically the filterable nodes if you want to edit nodes. In the filterable nodes section,
labels can be sorted within a group using drag and drop. The sorting will be saved.

Additionally, a new group can be created by using the "+" button,
and a group can be deleted using the "-" button. Filter labels in the deleted group
will automatically be moved back to the default group after deletion.

When clicking on a label (button), a dialog window opens with three functions: rename, delete, and
apply the label globally or to all nodes, trains, or notes.

- Rename: Allows you to change the name of the label.
- Delete: Removes the label globally, means it will be removed from all visible elements, such as
  nodes, trains, or notes. (If filtering is active the label might be still in use in invisible
  elements therefore it can not be deleted.)
- Apply: Transfers the label to all visible elements such as nodes, trains, or notes. This means that
  the label will be added to all visible nodes, trains, or notes.

These functions provide flexibility in managing and customizing labels according to your needs.

<details>
<summary>
Filtering trainrun with filterable labels
</summary>

[2024-1-25-Filtering-002.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/833ad548-0e1b-4e89-9746-346f1213bc19)

</details>

<details>
<summary>
Filtering nodes with filterable labels
</summary>

[2024-1-25-Filtering-NodeLabels_Editing.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/270b769d-f0a4-41c9-a01b-913931220326)

[2024-1-25-Filtering-NodeLabels_Editing-FilterOnOff.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/c8f8a287-5ab5-421d-8b53-d403ba3c243f)

</details>

#### Modifiy filterable labels

[2024-1-25-Filtering-Modify_Labelgroups_003.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/d9fd62d5-3233-425c-8489-d80c7fe6f558)

### Filter display

To show/hide elements, you can use the following steps:

<details>
<summary>
Show/hide times and trainrun names
</summary>

[2024-1-25-Filtering-Display_Text.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/5c118c27-6fad-499e-a1f9-9c39afb1107b)

</details>

<details>
<summary>
Show/hide connections
</summary>

[2024-1-25-Filtering-Display_Text-001.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/2674075/0852cc32-2215-4c57-9544-77b3da1bd44b)

</details>

### Saved filters

The function for saving filters makes it possible to save filter settings so that they can be used
again quickly. These saved filters are stored within the respective project variant.
