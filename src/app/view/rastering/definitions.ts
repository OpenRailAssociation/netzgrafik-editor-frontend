export const RASTERING_BASIC_GRID_SIZE = 32;

/*
  Node rastering properties
 */
export const NODE_POSITION_BASIC_RASTER = RASTERING_BASIC_GRID_SIZE;
export const NODE_MIN_WIDTH = 3 * RASTERING_BASIC_GRID_SIZE;
export const NODE_MIN_HEIGHT = 2 * RASTERING_BASIC_GRID_SIZE;
export const NODE_EDGE_WIDTH = 2;
export const NODE_PIN_SPAN = RASTERING_BASIC_GRID_SIZE;

export const NODE_TEXT_AREA_HEIGHT = 28; // ( NODE_EDGE_WIDTH * 2 + NODE_TEXT_AREA_HEIGHT ) = 2 * RASTERING_BASIC_GRID_SIZE
export const NODE_TEXT_LEFT_SPACING = 8;
export const NODE_ANALYTICS_AREA_HEIGHT = 12;

export const NOTE_POSITION_BASIC_RASTER = RASTERING_BASIC_GRID_SIZE;
export const NOTE_TEXT_AREA_HEIGHT = 28;
export const NOTE_TEXT_LEFT_SPACING = 8;

export const TEXT_SIZE = 16;
export const DEFAULT_PIN_RADIUS = 6;
export const DEFAULT_STOP_ICON = 4;

/*
  https://xd.adobe.com/view/e4664ae0-be8f-40e4-6a55-88aec9eafd8d-9257/screen/b5ed9deb-0306-4d66-96cf-43dae05dd2ee/
     | LINE_AREA_SPAN                      LINE_AREA_SPAN|
     |          00                                   20  |
   n |<------------->|<----------------->|<------------->| n
   o |   05                                  25          | o
   d |                                                   | d
   e |_|____|_|____|_|                   |_|____|_|____|_| e
     |4  24  4  24  8|                   |8  24  4  24  4|
     |                                                   |
     |       x                                           |  : middle / middle -> Text alignment
     |   c       c                                       |  : center (close / far)
     |  -14     +14                                      |
     |                                                   |
     |                                                   |
     |                                                   |
 */
export const TRAINRUN_SECTION_PORT_SPAN_HORIZONTAL = 32;
export const TRAINRUN_SECTION_PORT_SPAN_VERTICAL = 32;

export const TRAINRUN_SECTION_LINE_AREA_SPAN = 64;
export const TRANSITION_LINE_AREA_SPAN = 8;
export const BEZIER_CONTROL_POINT_FACTOR = 0.6;
export const BEZIER_CONTROL_SAME_ALIGNMENT_DIFFERENCE = 32;
export const TRAINRUN_SECTION_LINE_TEXT_HEIGHT = 16;

export const TRAINRUN_SECTION_TIME_CLOSE_NODE = -14; // c : Center close
export const TRAINRUN_SECTION_TIME_FAR_NODE = 14; // c : Center far
export const TRAINRUN_SECTION_TIME_CENTER = 32;
export const TRAINRUN_SECTION_TIME_TOP = -4;
export const TRAINRUN_SECTION_TIME_BOTTOM = 4;

export const TRAINRUN_SECTION_TEXT_AREA_WIDTH = 20;
export const TRAINRUN_SECTION_TEXT_AREA_HEIGHT = 20;

export const EDITOR_MENU_HEIGHT = 60;

export const SHOW_MAX_SINGLE_TRAINRUN_SECTIONS_STOPS = 5;

/*
  Text rotation and path constants for trainrun sections
 */
export const MIN_PATH_LENGTH_FOR_ANGLE = 4;
export const ANGLE_UPSIDE_DOWN_THRESHOLD = 90;
export const EDGE_CASE_THRESHOLD = 1;
export const DEFAULT_ANGLE_VERTICAL = -90;
export const DEFAULT_ANGLE_HORIZONTAL = 0;
export const PATH_COMPARISON_TOLERANCE = 0.01;
