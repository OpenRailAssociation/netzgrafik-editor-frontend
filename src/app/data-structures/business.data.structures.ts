/* This file contains data structure of the Netzgrafik Dtos. The model files encapsulate these data structures and
add's additional functionality */

import {
  ColorRefType,
  ConnectionDto,
  PathDto,
  PortDto,
  TimeLockDto,
  TransitionDto,
  WarningDto,
} from "./technical.data.structures";

/**
 * Represents the data for user defined note elements. The FreeFloatingText has a position,
 * a dimension and user defined title and text. It can as well hold filterable labels.
 */
export interface FreeFloatingTextDto {
  id: number; // unique identifier
  x: number; // user defined position (cooridination y)
  y: number; // user defined position (cooridination y)
  width: number; // automatically calculated dimension (height)
  height: number; // automatically calculated dimension (height)
  title: string; // user defined title (human-readable)
  text: string; // user defined text (human-readable)
  backgroundColor: string; // Not a ColorRef , such html color, eg. #F0F0F0
  textColor: string; // Not a ColorRef , such html color, eg. #FF0000
  labelIds: number[]; // list of assigned filterable labels (identifiers: See Label, LabelDto.)
}

/**
 * Represents a color element for rendering (see. Theme).
 */
export interface NetzgrafikColorDto {
  id: number; // unique identifier
  colorRef: ColorRefType; // color Ref identifier -> uniqueness (business id) !!!

  color: string; // html color, eg. #FF0000
  colorFocus: string; // html color, eg. #FF0000
  colorMuted: string; // html color, eg. #FF0000
  colorRelated: string; // html color, eg. #FF0000

  colorDarkMode: string; // html color, eg. #FF0000
  colorDarkModeFocus: string; // html color, eg. #FF0000
  colorDarkModeMuted: string; // html color, eg. #FF0000
  colorDarkModeRelated: string; // html color, eg. #FF0000
}

/**
 * Represents a trainrun category and declares the business logic / behavior such as,
 * stopping (HaltezeitFachCategories) strategies (default), reservation time (headway)
 * minimal turnnaround time
 */
export interface TrainrunCategory {
  id: number; // unique identifier
  order: number; // rendering order (see eg. TrainrunDialog buttons alignment)
  name: string; // long name
  shortName: string; // short name -> uniqueness (business id) !!!
  fachCategory: HaltezeitFachCategories; // reference to the HaltezeitFachCategories
  colorRef: ColorRefType; // declares how-to color the rendered object (rendering)
  minimalTurnaroundTime: number; //  inminutes
  nodeHeadwayStop: number; // in minutes
  nodeHeadwayNonStop: number; // in minutes
  sectionHeadway: number; // in minutes
}

/**
 * Represents the trainrun frequency object which holds information about the frequency a trainrun
 * is operated.
 */
export interface TrainrunFrequency {
  id: number; // unique identifier
  order: number; // rendering order (see eg. TrainrunDialog buttons alignment)
  frequency: number; // in minutes
  offset: number; // in minutes
  name: string; // long name
  shortName: string; // short name -> uniqueness (business id) !!!
  linePatternRef: LinePatternRefs; // decares how-to style the line (rendering)
}

/**
 * Represents a trainrun time category and declares the business logic / behavior such when the
 * train will be operated, such as 24h, HVZ, ...
 */
export interface TrainrunTimeCategory {
  id: number; // unique identifier
  order: number; // rendering order (see eg. TrainrunDialog buttons alignment)
  name: string; // long name
  shortName: string; // short name -> uniqueness (business id) !!!
  dayTimeInterval: TimeInterval[]; // time intervals - empty 24h running
  weekday: number[]; // list of integer encoding weekdays 1: Monday , ... , 7 : Sunday
  linePatternRef: LinePatternRefs; // decares how-to style the line (rendering)
}

/**
 * Represents a time interval element. It decaleres the interval [from , to]
 */
export interface TimeInterval {
  from: number; // in minutes since midnight, start from, inclueded
  to: number; //  in minutes since midnight, end to, included
}

/**
 * Represents a trainrun section. This is a main object, part of the fields must be manually entered
 * during editing and other elements are automatically set. The trainrun section is an edge in the
 * undirected graph. There is a source and target (start, end). But it holds two different direction
 * from source to target / and from target to source. Foreach direction the time can be defined when
 * the train leaves the source node and arrives at the target nodes or vice-versa. Important to
 * understand that the time gets automatically updated when changed such as the periodic interval
 * timetable is satisfied. Thus, if source departure time gets changed to 6, the source arrival time
 * gets recalulated 60 - 6 = 54.
 */
export interface TrainrunSectionDto {
  id: number; // unique identifier
  sourceNodeId: number; // reference to the node by Node.id
  sourcePortId: number; // reference to the node by Node.id
  targetNodeId: number; // reference to the node by Node.id
  targetPortId: number; // reference to the node by Node.id

  sourceArrival: TimeLockDto; // declares the soruce arrival time
  sourceDeparture: TimeLockDto; // declares the soruce departure time
  targetArrival: TimeLockDto; // declares the target arrival time
  targetDeparture: TimeLockDto; // declares the target departure time
  travelTime: TimeLockDto; // declares the travel arrival time

  numberOfStops: number; // number of stops - not declared in detail (no node attached)

  trainrunId: number; // reference to the trainrun (main object)
  resourceId: number; // reference to the algined (resource - not yet implemented)

  specificTrainrunSectionFrequencyId: number | null; // Default 0 - deprecate???
  path: PathDto; // cached - precomputed path for rendering
  warnings: WarningDto[] | null; // business logic failures - warnings storage
}

/**
 * Represents the enumartor to group the labels
 */
export enum LabelRef {
  Undefinded = "Undefined",
  Node = "Node",
  Trainrun = "Trainrun",
  Note = "Note",
}

/**
 * Represents a filterable Label
 */
export interface LabelDto {
  id: number; // unique indentifier
  label: string; // name of the label
  labelGroupId: number; // reference to the labelgroup
  labelRef: LabelRef; // label ref - declares the label group - used for double check - deprecate???
}

/**
 * Represents a filterable LabelGroup - in general one group per LabelRef are avaible, but user can
 * add more and algine labels to the right groups (right means = LabelRef must correspond to the
 * LabelRef in the Label)
 */
export interface LabelGroupDto {
  id: number; // unique indentifier
  name: string; // label group name
  labelRef: LabelRef; // all labels in the group must have this label (shortings)
}

/**
 * Represents the main element for the node.
 */
export interface NodeDto {
  id: number; // unique indentifier
  betriebspunktName: string; // BNWD -> 2-4 char name -> uniqueness (business id) !!!-
  fullName: string; // full name of the trainrun eg. BN => Bern Wankdorf
  positionX: number; // coordinate X
  positionY: number; // coordinate Y

  ports: PortDto[]; // all ports aligned to the node
  transitions: TransitionDto[]; // all tranisitons aligned to the node
  connections: ConnectionDto[]; // all connections aligned to the node

  resourceId: number | null; // reference to the algined (resource - not yet implemented)
  perronkanten: number; // number of tracks where train can stop
  connectionTime: number; // aka Umsteigezeit - time used to change train in minutes
  trainrunCategoryHaltezeiten: TrainrunCategoryHaltezeit; // user can over-write the halte times
  symmetryAxis: number | null; // deprecate ???
  warnings: WarningDto[] | null; // business logic failures - warnings storage

  labelIds: number[]; // list of assigned filterable labels (identifiers: See Label, LabelDto.)
}

/**
 * Represents the main element for the trainrun.
 */
export interface TrainrunDto {
  id: number; // unique indentifier
  name: string; // name of the trainrun
  categoryId: number; // reference to the trainrun category
  frequencyId: number; // reference to the trainrun frequency
  trainrunTimeCategoryId: number; // reference to the trainrun time category
  labelIds: number[];
  direction: Direction; // direction of the trainrun
}

/**
 * Represents a special element that maps Halte policy based on products.
 * This element is specific to SBB CFF FFS.
 */
export enum HaltezeitFachCategories {
  IPV = "HaltezeitIPV",
  A = "HaltezeitA",
  B = "HaltezeitB",
  C = "HaltezeitC",
  D = "HaltezeitD",
  Uncategorized = "HaltezeitUncategorized",
}

/**
 * Reprensents the LinePatterns how to render the elements (lines). The encoding is implemented
 * in SCSS. The line pattern is standardize in timetable planning.  Mapping.
 */
export enum LinePatternRefs {
  Freq120 = "120", // -.-.-.  ; unique indentifier
  Freq60 = "60", // ----- ; unique indentifier
  Freq30 = "30", // ==== ; unique indentifier
  Freq20 = "20", // three lines  ; unique indentifier
  Freq15 = "15", // four lines ; unique indentifier
  TimeCat7_24 = "7/24", // . . . ; unique indentifier
  TimeCatHVZ = "HVZ", // . : . : ; unique indentifier
  TimeZeitweise = "ZEITWEISE", // : - : - ; unique indentifier
}

/**
 * Represents the overwriteable Haltetimes (stop-times) - default - attached to each node.
 * Minimal stopping times in minutes.
 */
export interface TrainrunCategoryHaltezeit {
  [HaltezeitFachCategories.IPV]: Haltezeit;
  [HaltezeitFachCategories.A]: Haltezeit;
  [HaltezeitFachCategories.B]: Haltezeit;
  [HaltezeitFachCategories.C]: Haltezeit;
  [HaltezeitFachCategories.D]: Haltezeit;
  [HaltezeitFachCategories.Uncategorized]: Haltezeit;
}

/**
 * Declares the minimal Haltezeit (stop time) and policy whether there is for this product a
 * stop by default planed or not (at certain Node)
 */
export interface Haltezeit {
  haltezeit: number; // in minutes
  no_halt: boolean; // no halt per default
}

export interface OriginDestinationSettingsDto {
  // TODO: we may want a UI to display/edit this.
  connectionPenalty: number; // the cost to add for each connection, in minutes
}

export interface AnalyticsSettingsDto {
  originDestinationSettings: OriginDestinationSettingsDto;
}

/**
 * Groups Meta data in exported JSON / internal data structure (global properties for a project)
 */
export interface MetadataDto {
  trainrunCategories: TrainrunCategory[];
  trainrunFrequencies: TrainrunFrequency[];
  trainrunTimeCategories: TrainrunTimeCategory[];
  netzgrafikColors: NetzgrafikColorDto[];
  analyticsSettings: AnalyticsSettingsDto;
}

/**
 * Represents an abstructuion for resource magement. Resource alignemend - Net yet implemented
 */
export interface ResourceDto {
  id: number; // unique indentifier
  capacity: number; // maximal train allowed on the resource at time
}

/**
 * Represents the filter settings, which can be stored.
 */
export interface FilterSettingDto {
  id: number; // unique indentifier
  name: string; // name
  description: string; // description
  filterNodeLabels: number[]; // labels to filter out (labels only of type - LabelRef: node)
  filterNoteLabels: number[]; // labels to filter out (labels only of type - LabelRef: note)
  filterTrainrunLabels: number[]; // labels to filter out (labels only of type - LabelRef: trainrun)
  filterDirectionArrows: boolean; // flag for trainrun direction arrows (hide/show)
  filterArrivalDepartureTime: boolean; // flag for arrival and departure time filtering (hide/show)
  filterTravelTime: boolean; // flag for travel time filter (hide/show)
  filterTrainrunName: boolean; // flag for trainrun time filter (hide/show)
  filterConnections: boolean; // flag for connections filtering (hide/show)
  filterShowNonStopTime: boolean; // flag for non-stop time filtering (hide/show)
  filterTrainrunCategory: TrainrunCategory[]; // list of category to filter out
  filterTrainrunFrequency: TrainrunFrequency[]; // list of frequency to filter out
  filterTrainrunTimeCategory: TrainrunTimeCategory[]; // list of time categroy to filter out
  filterDirection: Direction[]; // list of trainrun direction to filter out
  filterAllEmptyNodes: boolean; // flag to filter all empty nodes (hide/show)
  filterAllNonStopNodes: boolean; // flag to filter all only non-stop nodes (hide/show)
  filterNotes: boolean; // flag to filter notes (hide/show)
  timeDisplayPrecision: number; // display time precision : default 2 numbers -> 0.1, 0.05
  isTemporaryDisableFilteringOfItemsInView: boolean; // flag to disable temporally all filering (show all)
  temporaryEmptyAndNonStopFilteringSwitchedOff: boolean; // flag to disable temporally all filer empty or non-stop nodes (node) (show all)
}

/**
 * Represents the storage to store all predefined filtering (filter settings)
 */
export interface FilterDataDto {
  filterSettings: FilterSettingDto[];
}

/**
 * Reprensents the storage of the Netzgrafik - full data.
 */
export interface NetzgrafikDto {
  nodes: NodeDto[]; // list of all nodes - analog database (DB) table
  trainrunSections: TrainrunSectionDto[]; // list of all trainrun sections - analog DB table
  trainruns: TrainrunDto[]; // list of all trainruns - analog DB table
  resources: ResourceDto[]; // list of all resources - analog DB table
  metadata: MetadataDto; // global settings / definitions
  freeFloatingTexts: FreeFloatingTextDto[]; //list of all notes - analog database (DB) table
  labels: LabelDto[]; // list of all labels - DB table (filterable labels)
  labelGroups: LabelGroupDto[]; // list of all label groups - DB table (filterable groups)
  filterData: FilterDataDto; // reference to the filter settings (predefined filters)
}

/**
 * Represents the trainrun direction.
 */
export enum Direction {
  ROUND_TRIP = "round_trip",
  ONE_WAY = "one_way",
}
