# Operations

## Angular EventEmitter

The Angular EventEmitter is used to emit custom events in Angular applications. It is an essential part of Angular's event handling mechanism.

[Angular EventEmitter Documentation](https://v17.angular.io/api/core/EventEmitter)

## Design of Operation class

The Operation class is designed to represent various operations performed on different entities within the application. Each operation has a type (create, update, delete), a payload (the entity being operated on), and optional parameters. This design allows for a standardized way to handle and emit changes to entities. The Operation class is an abstract class with the following properties:

```txt
- type: The type of operation (create, update, delete).
- objectType: The type of object the operation is performed on (trainrun, node).
- object: The object on which the operation is performed.
```

## Why do we want to emit events about NGE change

Emitting events about NGE changes is crucial for ensuring that all parts of the application are aware of modifications. This is especially useful when NGE is integrated into another application, as it allows for seamless updates and synchronization of state across different components.

The emission of these events doesn't impact the general behavior of the application, and if the user doesn't need these events, the Operations can be simply ignored.

## NGE Operations

The operations related to the NGE framework are used to handle changes to Trainrun, Node and Label entities. These operations ensure that any modifications are properly tracked and emitted, allowing for real-time updates and consistency within the application.

### Current list of actions available in NGE

#### Trainrun

- create Trainrun manually => TrainrunOperation(create)
- duplicate Trainrun (selection + CTRL-D key) => TrainrunOperation(create)
- duplicate Trainrun (trainrun window, Duplicate trainrun button) => TrainrunOperation(create)
- copy-paste a Trainrun (selection + CTRL-C key then CTRL-V key) => TODO: complicated -> works due to merge
- modify TrainrunSections manually (add trainrunSection manually from one node to another) => TrainrunOperation(update)
- modify TrainrunSections manually (modify a trainrunSection manually by reconnecting a port to another node) => TrainrunOperation(update)
- modify TrainrunSections manually (delete a trainrunSection manually by reconnecting a port to empty space) => TrainrunOperation(update)
- modify TrainrunSection sourceDeparture incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection sourceDeparture in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify TrainrunSection targetArrival incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection targetArrival in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify TrainrunSection targetDeparture incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection targetDeparture in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify TrainrunSection sourceArrival incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection sourceArrival in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify TrainrunSection travelTime incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection travelTime in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify TrainrunSection numberOfStops incrementally (trainrun window or Perlenkette, +/- button) => TrainrunOperation(update)
- modify TrainrunSection numberOfStops in one go (trainrun window or Perlenkette, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- modify Trainrun name (trainrun window or Perlenkette, fill in the box + ENTER key / click elsewhere) => TrainrunOperation(update)
- modify Trainrun category (trainrun window or Perlenkette, select another category) => TrainrunOperation(update)
- modify Trainrun frequency (trainrun window or Perlenkette, select another frequency) => TrainrunOperation(update)
- modify Trainrun direction (trainrun window, set round trip or one-way) => TrainrunOperation(update)
- modify Trainrun timeCategory (trainrun window or Perlenkette, select another time range) => TrainrunOperation(update)
- modify Trainrun transition stop (main window or Perlenkette, click on the hexagon in the middle of a node) => TrainrunOperation(update)
- (if it does not exist, create and) add Trainrun label (trainrun window, fill in the box then ENTER key / click elsewhere) => TrainrunOperation(update)
- delete Trainrun label (trainrun window, delete label button) => TrainrunOperation(update)
- delete Trainrun (selection + DEL key) => TrainrunOperation(delete)
- delete Trainrun (trainrun window, Delete trainrun button) => TrainrunOperation(delete)
- delete Trainrun (if only one section, drag one of the points to empty space) => TrainrunOperation(delete)

#### Node

- create Node manually => NodeOperation(create)
- copy-paste one or more Nodes (selection + CTRL-C key then CTRL-V key) => n\*(NodeOperation(create))
- duplicate one or more Nodes (selection + CTRL-D key) => n\*(NodeOperation(create))
- modify Node name (node window, fill in the box then ENTER key / click elsewhere) => NodeOperation(update) / TODO: triggered on change (not great)
- modify Node betriebspunktName (node window, fill in the box then ENTER key / click elsewhere) => NodeOperation(update) / TODO: triggered on change (not great)
- modify Node connectionTime (node window, fill in the box then ENTER key / click elsewhere) => NodeOperation(update)
- modify Node capacity (node window, fill in the box then ENTER key / click elsewhere) => none (because it is just informative)
- modify Node IPV stoppingTime time (node window, fill in the box then ENTER key / click elsewhere) => none (disabled feature)
- modify Node IPV stoppingTime noStop (node window, tick button) => none (disabled feature)
- modify Node A stoppingTime time (node window, fill in the box then ENTER key / click elsewhere) => none (disabled feature)
- modify Node A stoppingTime noStop (node window, tick button) => none (disabled feature)
- modify Node B stoppingTime time (node window, fill in the box then ENTER key / click elsewhere) => none (disabled feature)
- modify Node B stoppingTime noStop (node window, tick button) => none (disabled feature)
- modify Node C stoppingTime time (node window, fill in the box then ENTER key / click elsewhere) => none (disabled feature)
- modify Node C stoppingTime noStop (node window, tick button) => none (disabled feature)
- modify Node D stoppingTime time (node window, fill in the box then ENTER key / click elsewhere) => none (disabled feature)
- modify Node D stoppingTime noStop (node window, tick button) => none (disabled feature)
- modify Node position (cross cursor + drag) => NodeOperation(update)
- modify Nodes positions (multi selection, cross cursor + drag) => n\*(NodeOperation(update))
- (if it does not exist, create and) add Node label (node window, fill in the box then ENTER key / click elsewhere) => NodeOperation(update)
- delete Node label (node window, delete label button) => NodeOperation(update)
- delete Node (selection + DEL key) => NodeOperation(delete)
- delete Nodes (multi selection + DEL key) => n\*(NodeOperation(delete))
- delete Node (node window, Delete node button) => NodeOperation(delete)
- duplicate Node (selection + CTRL-D key) => NodeOperation(create)

#### Note

- create Note manually => NoteOperation(create)
- edit Note content/size (note dialog, title/body) => NoteOperation(update)
- delete Note (selection + DEL key or via note dialog) => NoteOperation(delete)
- duplicate Note (selection + CTRL-D key or via dedicated button) => NoteOperation(create)
- move Note to front (z-order) => NoteOperation(update)
- set Note labels (apply/remove) => NoteOperation(update)
- delete Note label from visible notes (filterable labels) => NoteOperation(update)

#### Label

- update Label (edit sidebar, Filterable labels / Trainruns, click on a label to edit it) => LabelOperation(update)

## Future work

The current design can be improved by providing more information in the event payload or making the framework more generic. New ideas and suggestions are welcome. Additionally, we will learn from the practical use of this framework and iterate on its design accordingly.
