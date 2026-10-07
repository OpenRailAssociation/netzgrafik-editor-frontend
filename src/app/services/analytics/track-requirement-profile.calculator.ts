export interface TrackOccupationInterval {
  startMinute: number;
  endMinute: number;
}

export interface TrackRequirementProfileSegment {
  startMinute: number;
  endMinute: number;
  requiredTrackCount: number;
}

export interface TrackRequirementProfile {
  segments: TrackRequirementProfileSegment[];
  maximumRequiredTrackCount: number;
  capacity?: number;
  utilizationPercent?: number;
  capacityStatus?: "sufficient" | "tight" | "overloaded";
}

const MINUTES_PER_HOUR = 60;

export function calculateTrackRequirementProfile(
  intervals: TrackOccupationInterval[],
  capacity?: number,
): TrackRequirementProfile {
  const requiredTracksByMinute = new Array<number>(MINUTES_PER_HOUR).fill(0);

  intervals.forEach((interval) => {
    const startMinute = normalizeMinute(interval.startMinute);
    const duration = Math.max(0, Math.floor(interval.endMinute - interval.startMinute));
    for (let minuteOffset = 0; minuteOffset <= duration; minuteOffset += 1) {
      requiredTracksByMinute[(startMinute + minuteOffset) % MINUTES_PER_HOUR] += 1;
    }
  });

  const maximumRequiredTrackCount = Math.max(...requiredTracksByMinute);
  const profile: TrackRequirementProfile = {
    segments: createProfileSegments(requiredTracksByMinute),
    maximumRequiredTrackCount,
  };

  if (capacity !== undefined && capacity > 0) {
    const utilizationPercent = (maximumRequiredTrackCount / capacity) * 100;
    profile.capacity = capacity;
    profile.utilizationPercent = utilizationPercent;
    profile.capacityStatus =
      maximumRequiredTrackCount > capacity
        ? "overloaded"
        : maximumRequiredTrackCount === capacity
          ? "tight"
          : "sufficient";
  }

  return profile;
}

function normalizeMinute(minute: number): number {
  return ((Math.floor(minute) % MINUTES_PER_HOUR) + MINUTES_PER_HOUR) % MINUTES_PER_HOUR;
}

function createProfileSegments(requiredTracksByMinute: number[]): TrackRequirementProfileSegment[] {
  const segments: TrackRequirementProfileSegment[] = [];
  let startMinute = 0;
  let requiredTrackCount = requiredTracksByMinute[0];

  for (let minute = 1; minute <= MINUTES_PER_HOUR; minute += 1) {
    const currentTrackCount =
      minute === MINUTES_PER_HOUR ? undefined : requiredTracksByMinute[minute];
    if (currentTrackCount !== requiredTrackCount) {
      segments.push({startMinute, endMinute: minute, requiredTrackCount});
      startMinute = minute;
      requiredTrackCount = currentTrackCount;
    }
  }

  return segments;
}