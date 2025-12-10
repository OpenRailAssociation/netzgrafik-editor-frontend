import {TrainrunSection} from "./trainrunsection.model";
import {Node} from "./node.model";
import {Trainrun} from "./trainrun.model";
import {PortAlignment, TimeLockDto} from "../data-structures/technical.data.structures";
import {Resource} from "./resource.model";
import {Connection} from "./connection.model";

describe("TrainrunSection Model Test", () => {
  it("setSourceAndTargetNodeReference", () => {
    const ts = new TrainrunSection();
    const node1 = new Node();
    const node2 = new Node();
    ts.setSourceAndTargetNodeReference(node1, node2);
    expect(ts.getSourceNodeId()).toBe(node1.getId());
    expect(ts.getSourceNode().getId()).toBe(node1.getId());
    expect(ts.getTargetNodeId()).toBe(node2.getId());
    expect(ts.getTargetNode().getId()).toBe(node2.getId());
  });

  it("setTrainrun", () => {
    const ts = new TrainrunSection();
    const trainrun = new Trainrun();
    ts.setTrainrun(trainrun);
    expect(ts.getTrainrunId()).toBe(trainrun.getId());
    expect(ts.getTrainrun().getId()).toBe(trainrun.getId());
  });

  it("setSourceDepartureDto", () => {
    const timeLockDto: TimeLockDto = {
      time: 25,
      consecutiveTime: 125,
      lock: false,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: null,
    };
    const ts = new TrainrunSection();
    ts.setSourceDepartureDto(timeLockDto);
    expect(ts.getSourceDeparture()).toBe(25);
    expect(ts.getSourceDepartureConsecutiveTime()).toBe(125);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.hasSourceDepartureWarning()).toBe(true);
    ts.resetSourceDepartureWarning();
    expect(ts.hasSourceDepartureWarning()).toBe(false);
  });

  it("setSourceArrivalDto", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: null,
    };
    const ts = new TrainrunSection();
    ts.setSourceArrivalDto(timeLockDto);
    expect(ts.getSourceArrival()).toBe(-25);
    expect(ts.getSourceArrivalConsecutiveTime()).toBe(-125);
    expect(ts.getSourceArrivalLock()).toBe(true);
    expect(ts.hasSourceArrivalWarning()).toBe(true);
    ts.resetSourceArrivalWarning();
    expect(ts.hasSourceArrivalWarning()).toBe(false);
  });

  it("setTargetDepartureDto", () => {
    const timeLockDto: TimeLockDto = {
      time: 25,
      consecutiveTime: 125,
      lock: false,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: null,
    };
    const ts = new TrainrunSection();
    ts.setTargetDepartureDto(timeLockDto);
    expect(ts.getTargetDeparture()).toBe(25);
    expect(ts.getTargetDepartureConsecutiveTime()).toBe(125);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.hasTargetDepartureWarning()).toBe(true);
    ts.resetTargetDepartureWarning();
    expect(ts.hasTargetDepartureWarning()).toBe(false);
  });

  it("setTargetArrivalDto", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: null,
    };
    const ts = new TrainrunSection();
    ts.setTargetArrivalDto(timeLockDto);
    expect(ts.getTargetArrival()).toBe(-25);
    expect(ts.getTargetArrivalConsecutiveTime()).toBe(-125);
    expect(ts.getTargetArrivalLock()).toBe(true);
    expect(ts.hasTargetArrivalWarning()).toBe(true);
    ts.resetTargetArrivalWarning();
    expect(ts.hasTargetArrivalWarning()).toBe(false);
  });

  it("setTravelTimeDto", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: null,
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTime()).toBe(-25);
    expect(ts.getTravelTimeLock()).toBe(true);
    expect(ts.hasTravelTimeWarning()).toBe(true);
    ts.resetTravelTimeWarning();
    expect(ts.hasTravelTimeWarning()).toBe(false);
  });

  it("set...Warning", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureWarning("A", "B");
    ts.setTargetArrivalWarning("C", "D");
    ts.setSourceDepartureWarning("E", "F");
    ts.setSourceArrivalWarning("G", "H");
    ts.setTravelTimeWarning(undefined, null);
    expect(ts.hasTargetDepartureWarning()).toBe(true);
    expect(ts.hasTargetArrivalWarning()).toBe(true);
    expect(ts.hasSourceDepartureWarning()).toBe(true);
    expect(ts.hasSourceArrivalWarning()).toBe(true);
    expect(ts.hasTravelTimeWarning()).toBe(true);
  });

  it("check...default...lock", () => {
    const ts = new TrainrunSection();
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(true);
  });

  it("set...lock", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(false);
  });

  it("set...lock - 1", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    ts.setTargetDepartureLock(true);
    expect(ts.getTargetDepartureLock()).toBe(true);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(false);
  });

  it("set...lock - 2", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    ts.setTargetArrivalLock(true);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(true);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(false);
  });

  it("set...lock - 3", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    ts.setSourceDepartureLock(true);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(true);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(false);
  });

  it("set...lock - 4", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    ts.setSourceArrivalLock(true);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(true);
    expect(ts.getTravelTimeLock()).toBe(false);
  });

  it("set...lock - 5", () => {
    const ts = new TrainrunSection();
    ts.setTargetDepartureLock(false);
    ts.setTargetArrivalLock(false);
    ts.setSourceDepartureLock(false);
    ts.setSourceArrivalLock(false);
    ts.setTravelTimeLock(false);
    ts.setTravelTimeLock(true);
    expect(ts.getTargetDepartureLock()).toBe(false);
    expect(ts.getTargetArrivalLock()).toBe(false);
    expect(ts.getSourceDepartureLock()).toBe(false);
    expect(ts.getSourceArrivalLock()).toBe(false);
    expect(ts.getTravelTimeLock()).toBe(true);
  });

  it("select", () => {
    const ts = new TrainrunSection();
    expect(ts.selected()).toBe(false);
    ts.select();
    expect(ts.selected()).toBe(true);
  });

  it("testTimeFormatter_001", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: null,
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe(undefined);
  });

  it("testTimeFormatter_002", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "Adrian",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("Adrian");
  });

  it("testTimeFormatter_003", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("35");
  });

  it("testTimeFormatter_004", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{consecutiveTime}}",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("-125");
  });

  it("testTimeFormatter_005", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: -125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "Negative? : {{consecutiveTime}}.format(HH:mm:ss)",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("Negative? : 21:55:00");
  });

  it("testTimeFormatter_006", () => {
    const timeLockDto: TimeLockDto = {
      time: -25,
      consecutiveTime: 125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "Positiv? : {{consecutiveTime}}.format(HH:mm:ss)",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("Positiv? : 02:05:00");
  });

  it("testTimeFormatter_007", () => {
    const timeLockDto: TimeLockDto = {
      time: 25,
      consecutiveTime: 125,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern: "{{time}} : {{consecutiveTime}}.format(HH:mm)",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe("25 : 02:05");
  });

  it("testTimeFormatter_008", () => {
    const timeLockDto: TimeLockDto = {
      time: 25.5,
      consecutiveTime: 125.5,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern:
          "Start {{time}} : {{consecutiveTime}}.format(HH:mm) : {{consecutiveTime}}.format(HH:mm:ss) : {{consecutiveTime}} END",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe(
      "Start 25.5 : 02:05 : 02:05:30 : 125.5 END",
    );
  });

  it("testTimeFormatter_009", () => {
    const timeLockDto: TimeLockDto = {
      time: 25.5,
      consecutiveTime: 125.5,
      lock: true,
      warning: {
        title: "test warning",
        description: "just for test",
      },
      timeFormatter: {
        colorRef: null,
        stylePattern:
          "Start {{time}} : {{time}}.format(HH:mm) : {{time}}.format(HH:mm:ss) : {{consecutiveTime}} END",
        textWidth: 20,
        htmlStyle: undefined,
      },
    };
    const ts = new TrainrunSection();
    ts.setTravelTimeDto(timeLockDto);
    expect(ts.getTravelTimeFormattedDisplayText()).toBe(
      "Start 25.5 : 00:25 : 00:25:30 : 125.5 END",
    );
  });

  it("Resource - id check", () => {
    const nc1 = new Resource();
    const nc1Data = nc1.getDto();
    nc1Data.id = nc1Data.id + 10;
    const nc2 = new Resource(nc1Data);
    expect(new Resource().getId()).toBe(nc2.getId() + 1);
  });

  it("Connection - select check", () => {
    const nc1 = new Connection();
    expect(nc1.selected()).toBe(false);
    nc1.select();
    expect(nc1.selected()).toBe(true);
    nc1.unselect();
    expect(nc1.selected()).toBe(false);
  });

  it("Connection - setWarning check 001", () => {
    const nc1 = new Connection();
    expect(nc1.hasWarning()).toBe(false);
    nc1.setWarning("Title");
    expect(nc1.hasWarning()).toBe(true);
  });

  it("Connection - setWarning check 002", () => {
    const nc1 = new Connection();
    expect(nc1.hasWarning()).toBe(false);
    nc1.setWarning("Title", "MSG");
    expect(nc1.hasWarning()).toBe(true);
  });

  it("getOppositeNode with trainrunsection - 001", () => {
    const node1 = new Node();
    const node2 = new Node();
    const node3 = new Node();
    const ts1 = new TrainrunSection();
    const ts2 = new TrainrunSection();
    ts1.setSourceAndTargetNodeReference(node1, node2);
    ts2.setSourceAndTargetNodeReference(node2, node3);
    const opp1 = node1.getOppositeNode(ts1);
    const opp2 = node1.getOppositeNode(ts2);
    const opp3 = node2.getOppositeNode(ts1);
    const opp4 = node2.getOppositeNode(ts2);
    const opp5 = node3.getOppositeNode(ts1);
    const opp6 = node3.getOppositeNode(ts2);
    expect(opp1.getId()).toBe(node2.getId());
    expect(opp2).toBe(undefined);
    expect(opp3.getId()).toBe(node1.getId());
    expect(opp4.getId()).toBe(node3.getId());
    expect(opp5).toBe(undefined);
    expect(opp6.getId()).toBe(node2.getId());
  });

  it("getTransition with trainrunsection - 001", () => {
    const tr = new Trainrun();
    const ts1 = new TrainrunSection();
    const node1 = new Node();
    const node2 = new Node();
    const node3 = new Node();
    ts1.setSourceAndTargetNodeReference(node1, node2);
    const ts2 = new TrainrunSection();
    ts2.setSourceAndTargetNodeReference(node2, node3);
    ts1.setTrainrun(tr);
    ts2.setTrainrun(tr);

    const port1 = node2.addPort(PortAlignment.Left, ts1);
    const port2 = node2.addPort(PortAlignment.Right, ts2);
    node2.addTransitionAndComputeRouting(node2.getPort(port1), node2.getPort(port2), tr, true);

    const t1 = node1.getTransition(ts1.getId());
    const t2 = node1.getTransition(ts2.getId());
    const t3 = node2.getTransition(ts1.getId());
    const t4 = node2.getTransition(ts2.getId());
    const t5 = node3.getTransition(ts2.getId());
    const t6 = node3.getTransition(ts2.getId());
    const t7 = node1.getTransition(-1);
    const t8 = node2.getTransition(-1);
    const t9 = node3.getTransition(-1);

    expect(t1).toBe(undefined);
    expect(t2).toBe(undefined);
    expect(t3.getId()).toBe(node2.getTransitions()[0].getId());
    expect(t4.getId()).toBe(node2.getTransitions()[0].getId());
    expect(t3.getId()).toBe(node2.getTransitionFromPortId(port1).getId());
    expect(t4.getId()).toBe(node2.getTransitionFromPortId(port2).getId());
    expect(t5).toBe(undefined);
    expect(t6).toBe(undefined);
    expect(t7).toBe(undefined);
    expect(t8).toBe(undefined);
    expect(t9).toBe(undefined);
  });

  it("isEndNode with trainrunsection - 001", () => {
    const tr = new Trainrun();
    const ts1 = new TrainrunSection();
    const node1 = new Node();
    const node2 = new Node();
    const node3 = new Node();
    ts1.setSourceAndTargetNodeReference(node1, node2);
    const ts2 = new TrainrunSection();
    ts2.setSourceAndTargetNodeReference(node2, node3);
    ts1.setTrainrun(tr);
    ts2.setTrainrun(tr);

    const port1 = node2.addPort(PortAlignment.Left, ts1);
    const port2 = node2.addPort(PortAlignment.Right, ts2);
    node2.addTransitionAndComputeRouting(node2.getPort(port1), node2.getPort(port2), tr, true);

    const e1 = node1.isEndNode(ts1);
    const e2 = node1.isEndNode(ts2);
    const e3 = node2.isEndNode(ts1);
    const e4 = node2.isEndNode(ts2);
    const e5 = node3.isEndNode(ts2);
    const e6 = node3.isEndNode(ts2);

    expect(e1).toBe(true);
    expect(e2).toBe(true);
    expect(e3).toBe(false);
    expect(e4).toBe(false);
    expect(e5).toBe(true);
    expect(e6).toBe(true);
  });

  it("getStartTrainrunSection with trainrunsection - 001", () => {
    const tr = new Trainrun();
    const ts1 = new TrainrunSection();
    const node1 = new Node();
    const node2 = new Node();
    const node3 = new Node();
    ts1.setSourceAndTargetNodeReference(node1, node2);
    const ts2 = new TrainrunSection();
    ts2.setSourceAndTargetNodeReference(node2, node3);
    ts1.setTrainrun(tr);
    ts2.setTrainrun(tr);

    const port1 = node2.addPort(PortAlignment.Left, ts1);
    const port2 = node2.addPort(PortAlignment.Right, ts2);
    node2.addTransitionAndComputeRouting(node2.getPort(port1), node2.getPort(port2), tr, true);

    const ts001 = node1.getExtremityTrainrunSection(tr.getId());
    const ts002 = node2.getExtremityTrainrunSection(tr.getId());
    const ts003 = node3.getExtremityTrainrunSection(tr.getId());

    expect(ts001).toBe(undefined);
    expect(ts002).toBe(undefined);
    expect(ts003).toBe(undefined);
  });

  it("check...shiftAllTimes", () => {
    const ts = new TrainrunSection();
    ts.setSourceDeparture(59);
    ts.setTargetArrival(9);
    ts.setTargetDeparture(51);
    ts.setSourceArrival(1);
    ts.setTravelTime(10);
    ts.shiftAllTimes(0, true);
    expect(ts.getSourceDeparture()).toBe(59);
    expect(ts.getTargetArrival()).toBe(9);
    expect(ts.getTargetDeparture()).toBe(51);
    expect(ts.getSourceArrival()).toBe(1);
    expect(ts.getTravelTime()).toBe(10);

    ts.shiftAllTimes(10, false);
    expect(ts.getSourceDeparture()).toBe(49);
    expect(ts.getTargetArrival()).toBe(59);
    expect(ts.getTargetDeparture()).toBe(1);
    expect(ts.getSourceArrival()).toBe(11);
    expect(ts.getTravelTime()).toBe(10);
  });
});
