# Batch Label Editing for Selected Nodes

## Overview
Introduce a batch-editing dialog that allows users to add or remove labels across multiple selected nodes. This improves efficiency when working with large selections and avoids overloading the existing filtering UI.

## Motivation
When editing a large number of nodes, individually opening each node’s edit dialog is time-consuming. A batch dialog enables simultaneous label operations, reducing clicks and potential errors.

## Acceptance Criteria
- [X] When multiple nodes are selected, any node's edit button opens a Batch Edit Dialog.
- [X] The dialog displays only labels shared by all selected nodes.
- [X] Users can add labels to all selected nodes.
- [X] Users can remove shared labels from all selected nodes.
- [X] Batch operations are atomic (all succeed or none).
- [X] UI remains responsive for large selections.
- [X] Error states are handled gracefully.

## Design

### Triggering the Dialog
- Currently, clicking the edit button on a node opens a single-node edit dialog.
- **Change:** If multiple nodes are selected (via Ctrl+click or shift-select), clicking any selected node’s edit button opens the batch dialog instead.
- The selection state is managed globally (e.g., in a `SelectionStore`).

### Batch Edit Dialog

The dialog contains two sections:

1. **Shared Labels List** – displays all labels that appear on every selected node. Each label has an “X” button to remove it from all nodes.
2. **Add Label Input** – text field with autocomplete (if existing labels exist) and an “Add” button. Adding a label appends it to all selected nodes.

### Atomicity
- All label additions and removals in a single dialog interaction (e.g., clicking “Save”) are performed as a single transaction.
- If any node fails to update (network error, validation), the entire operation is rolled back.
- Implementation: send a batch request to the backend or use a local transaction with undo.

### State Management
- Use a dedicated store (e.g., `BatchEditStore`) to hold:
  - `selectedNodeIds: string[]`
  - `sharedLabels: Set<string>`
  - `addedLabels: Set<string>` (pending additions)
  - `removedLabels: Set<string>` (pending removals)
- The store computes the final label set for each node.

### Backend API
- New endpoint: `POST /api/nodes/batch-labels`
  - Request body: `{ nodeIds: string[], addLabels?: string[], removeLabels?: string[] }`
  - Response: success/failure with details.
- If no backend changes are possible, implement atomicity client-side by collecting all operations and sending individual requests with error handling.

### UI Components
- `BatchEditDialog` – main dialog component.
- `SharedLabelList` – list of labels with remove buttons.
- `AddLabelInput` – input with autocomplete.
- `BatchEditButton` – wrapper around the node’s edit button that checks selection count.

### Edge Cases
- **No shared labels:** Display empty list, only add functionality.
- **Duplicate additions:** Ignore if label already exists on all nodes.
- **Empty selection:** Disable the button.
- **Large selections (1000+ nodes):** Debounce UI updates, use virtualized lists, and batch backend calls.

### Error Handling
- Show error toast if batch operation fails.
- Display inline error for invalid label names.
- Disable the dialog while operation is in progress.

## Implementation Plan
1. Create `BatchEditStore` with actions: `openDialog`, `closeDialog`, `addLabel`, `removeLabel`, `save`.
2. Modify node edit button to check selection count and trigger batch dialog.
3. Build `BatchEditDialog` component.
4. Implement atomic save: gather all add/remove actions, call backend, on failure revert.
5. Add loading and error states.
6. Write unit and integration tests.

## Mockups
(See attached images in the issue)

- Select multiple nodes.
- Click edit button -> Batch Edit Dialog opens.
- Dialog shows shared labels and add input.
- Remove or add labels, click Save.

## Estimated Effort
2 weeks (as per requirements).