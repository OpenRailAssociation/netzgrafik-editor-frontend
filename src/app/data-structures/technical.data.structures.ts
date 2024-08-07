// Type for ColorRefs (dynamic coloring, used in SCSS, ... )
export type ColorRefType = string;

/**
 * Represents a 2D point in a coordinate system - which can be exchanged/stored.
 *
 * See also Vec2D - which class describes fundamental 2D vector calculations.
 */
export interface PointDto {
  x: number; // The x-coordinate of the point.
  y: number; // The y-coordinate of the point.
}

/**
 * Represents an enumerator to classify trainrun section texts used in TrainrunSectionTextPositions
 *
 * See also TrainrunSectionDto and TimeLockDto.
 */
export enum TrainrunSectionText {
  SourceArrival,
  SourceDeparture,
  TargetArrival,
  TargetDeparture,
  TrainrunSectionName,
  TrainrunSectionTravelTime,
  TrainrunSectionNumberOfStops,
}

/**
 * Represents a mapping of TrainrunSectionText and PointDTO used in the "cached" path : PathDto.
 * The PathDto is used in the TrainrunSectionDto. The application (editor) recalculates after each
 * position update the path and stores the positions of the text in this mapping.
 */
export interface TrainrunSectionTextPositions {
  [TrainrunSectionText.SourceArrival]: PointDto;
  [TrainrunSectionText.SourceDeparture]: PointDto;
  [TrainrunSectionText.TargetArrival]: PointDto;
  [TrainrunSectionText.TargetDeparture]: PointDto;
  [TrainrunSectionText.TrainrunSectionName]: PointDto;
  [TrainrunSectionText.TrainrunSectionTravelTime]: PointDto;
  [TrainrunSectionText.TrainrunSectionNumberOfStops]: PointDto;
}

/**
 * Represents a cachable object, which gets recalculated after each position update of the
 * trainrunsection start and end points ( Nodes ). This recalculation is quite expensive therefore
 * during drawing/update the rendering system just reused the information from this
 * interface/object.
 */
export interface PathDto {
  path: PointDto[];
  textPositions: TrainrunSectionTextPositions;
}

/**
 * Represents the PortAlignment enumartor which declares the trainrun section node connecting side.
 */
export enum PortAlignment {
  Top,
  Bottom,
  Left,
  Right,
}

/**
 * Represents a general warning object widely used in different objects. E.g. TrainrunSection times.
 * The WarningDto is used to build a storeable warning object with human description.
 */
export interface WarningDto {
  title: string;
  description: string;
}

/**
 * Represents a special object which transforms numberic time data (number) into string and
 * formats the display. It can be used for user specific formating and changing rendering style
 * through html load. The TimeFormatter is optional in TimeLockDto.
 */
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

/**
 * Represents the time data in TrainrunSectionDto.
 */
export interface TimeLockDto {
  time: number | null; // minutes [0..60]
  consecutiveTime: number; // automatically updated after any data changes in the application
  lock: boolean; // used to stop the time propagation (forward/backward)
  warning: WarningDto; // warning - if business logic detects an issue -> set human-readable warning
  timeFormatter: TimeFormatter; // undefined or object - optional
}

/**
 * Represents the port which connects a TrainrunSection with a Node
 */
export interface PortDto {
  id: number; // unique identifier
  positionIndex: number; // position index starts at 0, ... for each PortAlignment group
  positionAlignment: PortAlignment; // defines corresponding PortAlignment group within the node
  trainrunSectionId: number; // reference to the connected trainrun section
}

/**
 * Represents an undirected edge in the graph for a transition (trainrun passes the node)
 */
export interface TransitionDto {
  id: number; // unique identifier
  port1Id: number; // reference (id) to the PortDto (1)
  port2Id: number; // reference (id) to the PortDto (2)
  isNonStopTransit: boolean; // Non-stop / stop
}

/**
 * Represents the trainrun connection which signifies the point in the logistic network
 * where two trains need to coordinated to ensure a smooth connection between them.
 * The port1 and port2 should have different trainrun assigned.
 */
export interface ConnectionDto {
  id: number; // unique identifier
  port1Id: number; // reference (id) to the PortDto (Idea: trainrun has to arrive before)
  port2Id: number; // reference (id) to the PortDto (Idea: trainrun has to wait)
}
