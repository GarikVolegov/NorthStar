/**
 * executors/index.ts — maps every RoutineType to its executor implementation.
 */
import type { RoutineExecutor } from "../routine-types.js";
import type { RoutineType }     from "../routine-types.js";
import { jobMonitorExecutor }      from "./job-monitor.js";
import { marketReportExecutor }    from "./market-report.js";
import { mindsetExerciseExecutor } from "./mindset-exercise.js";
import { growthBriefingExecutor }  from "./growth-briefing.js";
import { interviewPrepExecutor }   from "./interview-prep.js";
import { discoveryNudgeExecutor }  from "./discovery-nudge.js";

export { jobMonitorExecutor }      from "./job-monitor.js";
export { marketReportExecutor }    from "./market-report.js";
export { mindsetExerciseExecutor } from "./mindset-exercise.js";
export { growthBriefingExecutor }  from "./growth-briefing.js";
export { interviewPrepExecutor }   from "./interview-prep.js";
export { discoveryNudgeExecutor }  from "./discovery-nudge.js";

export const executorMap: Partial<Record<RoutineType, RoutineExecutor>> = {
  job_monitor:      jobMonitorExecutor,
  market_report:    marketReportExecutor,
  mindset_exercise: mindsetExerciseExecutor,
  growth_briefing:  growthBriefingExecutor,
  interview_prep:   interviewPrepExecutor,
  discovery_nudge:  discoveryNudgeExecutor,
};
