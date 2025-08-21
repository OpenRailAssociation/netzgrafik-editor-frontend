export class StaticDomTags {
  /*
   Global DOM Tags
   */
  static TAG_SELECTED = "selected";
  static TAG_WARNING = "warning";
  static TAG_HOVER = "hover";
  static TAG_FOCUS = "focus";
  static TAG_DRAGGING = "dragging";
  static TAG_MUTED = "muted";
  static TAG_RELATED = "related";
  static TAG_HIDDEN = "hidden";
  static TAG_CTRLKEY = "ctrlKey";

  static TAG_COLOR_REF = "ColorRef";
  static PREFIX_COLOR_VARIABLE = "COLOR_VARIABLE_ColorRef";
  static TAG_UI_DIALOG = "UI_DIALOG";
  static TAG_GRAYEDOUT = "grayedout";

  static TAG_LINEPATTERN_REF = "LinePatternRef";
  static TAG_EVENT_DISABLED = "event_disabled";
  static TAG_START_TEXT_ANCHOR = "start_text_anchor";
  static TAG_FILL = "fill";
  static TAG_HEADWAY_BAND = "headway_band";
  static TAG_HOVER_AREA = "hover_area";
  static TAG_MULTI_SELECTED = "multi_selected";
  static TAG_ENFORCE_DISABLE_ALL_POINTER_EVENTS = "enforce_disable_all_pointer_events";
  static TAG_ANALYTICS_ENFORCE_DISABLE = "analyitcs_enforce_disable";

  static TAG_Streckengraphik_not_displayable = "streckengraphik_not_displayable";

  static TAG_ANALYTICS_LEVEL = "analytics_level_";
  static TAG_ANALYTICS_LEVEL_0 = "analytics_level_0";
  static TAG_ANALYTICS_LEVEL_1 = "analytics_level_1";
  static TAG_ANALYTICS_LEVEL_2 = "analytics_level_2";
  static TAG_ANALYTICS_LEVEL_3 = "analytics_level_3";
  static TAG_ANALYTICS_LEVEL_4 = "analytics_level_4";
  static TAG_ANALYTICS_LEVEL_5 = "analytics_level_5";
  static TAG_ANALYTICS_TRAINRUNSECTION_TEXT_CLICKABLE = "analytics_trainrunsection_text_clickable";
  static TAG_ANALYTICS_TRAINRUNSECTION_TEXT_MUTED = "analytics_trainrunsection_text_muted";
  static TAG_ANALYTICS_TRAINRUNSECTION_TEXT_FOCUSED = "analytics_trainrunsection_text_focused";

  static LINE_LAYER = "layer";
  static FREQ_LINE_PATTERN = "Freq";

  /*
       GROUP object
     */
  static SVG = "svg";
  static GROUP_SVG = "g";
  static GROUP_DOM_REF = "g";

  /*
      NODE (root group)
       |- NODE_ROOT                  : root frame (visual container)
       |- NODE_BACKGROUND            : background (frame for visualisations only)
       |- NODE_DOCKABLE              : edge drawing/moving drag from and drop at this area
       |- NODE_LABELAREA             : frame where the node label is attached
       |- NODE_LABELAREA_TEXT        : text in-front of the node label are (drag node)
       |- NODE_CONNECTIONTIME_TEXT   : text in-front of the node connection time open detail view dialog on the right
     */
  static NODE_SVG = "g";
  static NODE_ROOT_CONTAINER = "root_container_nodes";
  static NODE_ROOT_CONTAINER_DOM_REF = "g.root_container_nodes";
  static NODE_CLASS = "node";
  static NODE_DOM_REF = "g.node";
  static NODE_ID = "id";
  static NODE_HIGHLIGHT = "highlighted";
  static NODE_HIGHLIGHT_DOM_REF = "rect.highlighted";
  static NODE_TO_FRONT = "to_front";
  static NODE_TO_FRONT_DOM_REF = "rect.to_front";
  static NODE_TAG_REQ_FOR_DRAGGING = "req_for_dragging";
  static NODE_TAG_JUNCTION_ONLY = "junction_only";
  static NODE_HAS_CONNECTIONS = "has_connections";
  static NODE_READONLY = "readonly";

  static NODE_HOVER_ROOT_SVG = "rect";
  static NODE_HOVER_ROOT_CLASS = "node_hover_root";
  static NODE_HOVER_ROOT_DOM_REF = "rect.node_hover_root";

  static NODE_ROOT_SVG = "rect";
  static NODE_ROOT_CLASS = "node_root";
  static NODE_ROOT_DOM_REF = "rect.node_root";

  static NODE_BACKGROUND_SVG = "rect";
  static NODE_BACKGROUND_CLASS = "node_background";
  static NODE_BACKGROUND_DOM_REF = "rect.node_background";

  static NODE_DOCKABLE_SVG = "rect";
  static NODE_DOCKABLE_CLASS = "node_dockable";
  static NODE_DOCKABLE_DOM_REF = "rect.node_dockable";

  static NODE_LABELAREA_SVG = "rect";
  static NODE_LABELAREA_CLASS = "node_labelarea";
  static NODE_LABELAREA_DOM_REF = "rect.node_labelarea";

  static NODE_ANALYTICSAREA_SVG = "rect";
  static NODE_ANALYTICSAREA_CLASS = "node_analyticsarea";
  static NODE_ANALYTICSAREA_DOM_REF = "rect.node_analyticsarea";

  static NODE_ANALYTICSAREA_TEXT_LEFT_SVG = "text";
  static NODE_ANALYTICSAREA_TEXT_LEFT_CLASS = "node_title_analyticsarea_left";
  static NODE_ANALYTICSAREA_TEXT_LEFT_DOM_REF = "text.node_title_analyticsarea_left";

  static NODE_ANALYTICSAREA_TEXT_RIGHT_SVG = "text";
  static NODE_ANALYTICSAREA_TEXT_RIGHT_CLASS = "node_title_analyticsarea_right";
  static NODE_ANALYTICSAREA_TEXT_RIGHT_DOM_REF = "text.node_title_analyticsarea_right";

  static NODE_LABELAREA_TEXT_SVG = "text";
  static NODE_LABELAREA_TEXT_CLASS = "node_text";
  static NODE_LABELAREA_TEXT_DOM_REF = "text.node_text";

  static NODE_CONNECTIONTIME_TEXT_SVG = "text";
  static NODE_CONNECTIONTIME_TEXT_CLASS = "node_connection_time";
  static NODE_CONNECTIONTIME_TEXT_DOM_REF = "text.node_connection_time";

  static NODE_HOVER_DRAG_AREA_SVG = "path";
  static NODE_HOVER_DRAG_AREA_CLASS = "node_hover_drag_root";
  static NODE_HOVER_DRAG_AREA_DOM_REF = "path.node_hover_drag_root";

  static NODE_HOVER_DRAG_AREA_BACKGROUND_SVG = "rect";
  static NODE_HOVER_DRAG_AREA_BACKGROUND_CLASS = "node_hover_drag_root_background";
  static NODE_HOVER_DRAG_AREA_BACKGROUND_DOM_REF = "rect.node_hover_drag_root_background";

  static NODE_EDIT_AREA_SVG = "path";
  static NODE_EDIT_AREA_CLASS = "node_edit_button";
  static NODE_EDIT_AREA_DOM_REF = "path.node_edit_button";

  static NODE_EDIT_AREA_BACKGROUND_SVG = "rect";
  static NODE_EDIT_AREA_BACKGROUND_CLASS = "node_edit_button_background";
  static NODE_EDIT_AREA_BACKGROUND_DOM_REF = "rect.node_edit_button_background";

  /*
    EDGE (root group)
     |- EDGE_LINE           : line
     |- EDGE_LINE_PIN       : pin
     |- EDGE_LINE_PIN       : pin
     |- EDGE_LINE_TEXT      : departure time
     |- EDGE_LINE_TEXT      : arrival time
     |- EDGE_LINE_TEXT      : departure time
     |- EDGE_LINE_TEXT      : arrival time
     |- EDGE_LINE_TEXT      : line name
     |- EDGE_LINE_LAYER_0   : rendering layer 0
     |- EDGE_LINE_LAYER_1   : rendering layer 1
     |- EDGE_LINE_LAYER_2   : rendering layer 2
     |- EDGE_LINE_LAYER_3   : rendering layer 3
   */
  static EDGE_SVG = "g";
  static EDGE_ROOT_CONTAINER = "root_container_edges";
  static EDGE_ROOT_CONTAINER_DOM_REF = "g.root_container_edges";
  static EDGE_CLASS = "edge";
  static EDGE_DOM_REF = "g.edge";
  static EDGE_ID = "id";
  static EDGE_NODE_ID = "node_id";
  static EDGE_IS_SOURCE = "is_source";
  static EDGE_IS_TARGET = "is_target";
  static EDGE_IS_END_NODE = "is_end_node";
  static EDGE_IS_NOT_END_NODE = "is_not_end_node";

  static EDGE_LINE_SVG = "path";
  static EDGE_LINE_CLASS = "edge_line";
  static EDGE_LINE_DOM_REF = "path.edge_line";
  static EDGE_LINE_LINE_ID = "trainrunId";
  static EDGE_LINE_SECTION_ID = "trainrunSectionId";

  static EDGE_LINE_LAYER_0 = StaticDomTags.LINE_LAYER + "_0";
  static EDGE_LINE_LAYER_1 = StaticDomTags.LINE_LAYER + "_1";
  static EDGE_LINE_LAYER_2 = StaticDomTags.LINE_LAYER + "_2";
  static EDGE_LINE_LAYER_3 = StaticDomTags.LINE_LAYER + "_3";
  static EDGE_LINE_GRAYEDOUT = StaticDomTags.TAG_GRAYEDOUT;

  static EDGE_LINE_ARROW_SVG = "path";
  static EDGE_LINE_ARROW_CLASS = "edge_line_arrow";
  static EDGE_LINE_ARROW_DOM_REF = "path.edge_line_arrow";
  static TAG_LINE_ARROW_EDITOR = "editor";

  static EDGE_LINE_PIN_SVG = "circle";
  static EDGE_LINE_PIN_CLASS = "edge_line_pin";
  static EDGE_LINE_PIN_DOM_REF = "circle.edge_line_pin";
  static EDGE_LINE_PIN_CONNECTION = "connection_pin";

  static EDGE_LINE_STOP_ICON_SVG = "path";
  static EDGE_LINE_STOP_ICON_CLASS = "edge_line_stop_arcs";
  static EDGE_LINE_STOP_ICON_CLASS_DOM_REF = "path.edge_line_stop_arcs";

  static EDGE_LINE_TEXT_SVG = "text";
  static EDGE_LINE_TEXT_CLASS = "edge_text";
  static EDGE_LINE_TEXT_DOM_REF = "text.edge_text";
  static EDGE_LINE_TEXT_INDEX = "edge_text_index";
  static EDGE_DISABLE_EVENTS = "no_event";
  static EDGE_LINE_TEXT_ODD_FREQUENCY = "OddFrequency";

  static EDGE_LINE_TEXT_BACKGROUND_SVG = "rect";
  static EDGE_LINE_TEXT_BACKGROUND_CLASS = "edge_text_background";
  static EDGE_LINE_TEXT_BACKGROUND_DOM_REF = "rect.edge_text_background";

  static EDGE_LINE_STOPS_GROUP_SVG = "g";
  static EDGE_LINE_STOPS_GROUP_CLASS = "edge_line_stops_group";
  static EDGE_LINE_STOPS_GROUP_DOM_REF = "g.edge_line_stops_group";

  static EDGE_LINE_STOPS_SVG = "circle";
  static EDGE_LINE_STOPS_CLASS = "edge_line_stops";
  static EDGE_LINE_STOPS_DOM_REF = "circle.edge_line_stops";
  static EDGE_LINE_STOPS_INDEX = "StopIndex";
  static EDGE_LINE_STOPS_FILL = StaticDomTags.TAG_FILL;
  /*
    TRANSITION (root group)
     |- TRANSITION_NODE_LINE      : node
     |- TRANSITION_LINE           : line
     |- TRANSITION_LINE_CLASS_0   : rendering layer 0
     |- TRANSITION_LINE_CLASS_1   : rendering layer 1
     |- TRANSITION_LINE_CLASS_2   : rendering layer 2
     |- TRANSITION_LINE_CLASS_3   : rendering layer 3
   */
  static TRANSITION_NODE_LINE_CLASS = "transition_node";
  static TRANSITION_ATTR_NODE_ID = "node_id";
  static TRANSITION_ROOT_CONTAINER = "root_container_transition";
  static TRANSITION_ROOT_CONTAINER_DOM_REF = "g.root_container_transition";
  static TRANSITION_GROUP_CLASS = "transition_group";
  static TRANSITION_GROUP_ATTR_TRANSITION_ID = "id";
  static TRANSITION_LINE_SVG = "path";
  static TRANSITION_LINE_CLASS = "transition_line";
  static TRANSITION_LINE_DOM_REF = "path.transition_line";
  static TRANSITION_LINE_CLASS_0 = StaticDomTags.LINE_LAYER + "_0";
  static TRANSITION_LINE_CLASS_1 = StaticDomTags.LINE_LAYER + "_1";
  static TRANSITION_LINE_CLASS_2 = StaticDomTags.LINE_LAYER + "_2";
  static TRANSITION_LINE_CLASS_3 = StaticDomTags.LINE_LAYER + "_3";
  static TRANSITION_BUTTON_SVG = "polygon";
  static TRANSITION_BUTTON_CLASS = "transition_pin";
  static TRANSITION_BUTTON_DOM_REF = "polygon.transition_pin";
  static TRANSITION_BUTTON_SIZE = 8;
  static TRANSITION_IS_NONSTOP = "nonstop";
  static TRANSITION_TRAINRUNSECTION_ID1 = "ts_id1";
  static TRANSITION_TRAINRUNSECTION_ID2 = "ts_id2";

  /*
    CONNECTION (root group)
   */
  static CONNECTION_NODE_LINE_CLASS = "connection_node";
  static CONNECTION_ROOT_CONTAINER = "root_container_connections";
  static CONNECTION_ROOT_CONTAINER_DOM_REF = "g.root_container_connections";
  static CONNECTION_ATTR_NODE_ID = "node_id";
  static CONNECTION_GROUP_CLASS = "connection_group";
  static CONNECTION_GROUP_ATTR_CONNECTION_ID = "id";
  static CONNECTION_LINE_SVG = "path";
  static CONNECTION_LINE_CLASS = "connection_line";
  static CONNECTION_LINE_DOM_REF = "path.connection_line";
  static CONNECTION_LINE_CLASS_0 = StaticDomTags.LINE_LAYER + "_0";
  static CONNECTION_LINE_CLASS_1 = StaticDomTags.LINE_LAYER + "_1";
  static CONNECTION_LINE_CLASS_2 = StaticDomTags.LINE_LAYER + "_2";
  static CONNECTION_LINE_CLASS_3 = StaticDomTags.LINE_LAYER + "_3";
  static CONNECTION_TAG_ONGOING_GDRAGGING = "connection_ongoing_dragging";

  static CONNECTION_LINE_PIN_SVG = "circle";
  static CONNECTION_LINE_PIN_CLASS = "connection_line_pin";
  static CONNECTION_LINE_PIN_DOM_REF = "circle.connection_line_pin";
  static CONNECTION_ID = "id";
  static CONNECTION_NODE_ID = "node_id";
  static CONNECTION_TRAINRUN_ID = "trainrun_id";
  static CONNECTION_PIN_DRAGGING = "connection_pin_dragging";
  static CONNECTION_NOT_VISIBLE = "not_visible";

  /*
    Multi Select Box
   */
  static PREVIEW_MULTISELECT_ROOT_BOX_SVG = "g";
  static PREVIEW_MULTISELECT_ROOT_BOX_CLASS = "multi_select_box_root";
  static PREVIEW_MULTISELECT_ROOT_BOX_DOM_REF = "g.multi_select_box_root";

  static PREVIEW_MULTISELECT_BOX_SVG = "rect";
  static PREVIEW_MULTISELECT_BOX_CLASS = "multi_select_box_root";
  static PREVIEW_MULTISELECT_BOX_DOM_REF = "rect.multi_select_box_root";
  /*
    PREVIEW_LINE
   */
  static PREVIEW_LINE_ROOT_SVG = "g";
  static PREVIEW_LINE_ROOT_CLASS = "preview_line_root";
  static PREVIEW_LINE_ROOT_DOM_REF = "g.preview_line_root";

  static PREVIEW_CONNECTION_LINE_ROOT_SVG = "g";
  static PREVIEW_CONNECTION_LINE_ROOT_CLASS = "connection_preview_line_root";
  static PREVIEW_CONNECTION_LINE_ROOT_DOM_REF = "g.connection_preview_line_root";

  static PREVIEW_LINE_SVG = "path";
  static PREVIEW_LINE_CLASS = "preview_line";
  static PREVIEW_LINE_DOM_REF = "path.preview_line";

  static PREVIEW_CONNECTION_LINE_SVG = "path";
  static PREVIEW_CONNECTION_LINE_CLASS = "preview_connection_line";
  static PREVIEW_CONNECTION_LINE_DOM_REF = "path.preview_connection_line";

  /* Note */
  static NOTE_ID = "id";
  static NOTE_SVG = "g";
  static NOTE_ROOT_CONTAINER = "root_container_notes";
  static NOTE_ROOT_CONTAINER_DOM_REF = "g.root_container_notes";
  static NOTE_CLASS = "note";

  static NOTE_HOVER_ROOT_SVG = "rect";
  static NOTE_HOVER_ROOT_CLASS = "note_hover_root";
  static NOTE_HOVER_ROOT_DOM_REF = "rect.note_hover_root";

  static NOTE_HOVER_DRAG_AREA_SVG = "path";
  static NOTE_HOVER_DRAG_AREA_CLASS = "note_hover_drag_root";
  static NOTE_HOVER_DRAG_AREA_DOM_REF = "path.note_hover_drag_root";

  static NOTE_HOVER_DRAG_AREA_BACKGROUND_SVG = "rect";
  static NOTE_HOVER_DRAG_AREA_BACKGROUND_CLASS = "note_hover_drag_root_background";
  static NOTE_HOVER_DRAG_AREA_BACKGROUND_DOM_REF = "rect.note_hover_drag_root_background";

  static NOTE_ROOT_SVG = "rect";
  static NOTE_ROOT_CLASS = "note_root";
  static NOTE_ROOT_DOM_REF = "rect.note_root";

  static NOTE_TITELAREA_SVG = "rect";
  static NOTE_TITELAREA_CLASS = "note_titelarea";
  static NOTE_TITELAREA_DOM_REF = "rect.note_titelarea";

  static NOTE_TITELAREA_TEXT_SVG = "text";
  static NOTE_TITELAREA_TEXT_CLASS = "titel_text";
  static NOTE_TITELAREA_TEXT_DOM_REF = "text.titel_text";

  static NOTE_TEXTAREA_SVG = "rect";
  static NOTE_TEXTAREA_CLASS = "note_textarea";
  static NOTE_TEXTAREA_DOM_REF = "rect.note_textarea";

  static NOTE_TEXT_SVG = "text";
  static NOTE_TEXT_CLASS = "note_text";
  static NOTE_TEXT_DOM_REF = "text.note_text";

  static KNOTENAUSLASTUNG_DATA_GROUP = "KnotenAuslastungDataGroup";
  static KNOTENAUSLASTUNG_DATA_GROUP_G = "g.KnotenAuslastungDataGroup";

  static KNOTENAUSLASTUNG_DATA_GROUP_PATH = "path.KnotenAuslastungDataGroup";
  static KNOTENAUSLASTUNG_DATA_GROUP_TEXT = "text.KnotenAuslastungDataGroup";

  static makeClassTag(tag: string, data: string): string {
    return " " + tag + "_" + data;
  }
}
