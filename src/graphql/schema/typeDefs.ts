import { gql } from "apollo-server-express";

export const typeDefs = gql`
  "P = Primary (high urgency, high importance), S = Secondary (low urgency, high importance), O = Outsource (high urgency, low importance), B = BucketList (low urgency, low importance)"
  enum Priority {
    P
    S
    O
    B
  }

  "How often an interval repeats: minute, hour, day, week, month, year"
  enum RepeatUnit {
    minute
    hour
    day
    week
    month
    year
  }

  "Interval status: active or inactive"
  enum IntervalStatus {
    active
    inactive
  }

  "How action was disposed in After-day wizard (null = still scheduled or done)"
  enum ActionFate {
    Postponed
    OutsourceWoo
    Backlog
    BucketList
    PassedArchived
  }

  "Source of gathered actions; null = user-created"
  enum ActionSourceType {
    interval
    routine
  }

  type Action {
    id: ID!
    title: String!
    tbd: String
    done: Boolean!
    priority: Priority!
    estimatedTimeMinutes: Int
    startTimeOfDay: String
    createdAt: String!
    project: Project
    sourceType: ActionSourceType
    sourceId: String
    forDate: String
    isGathered: Boolean!
    actionFate: ActionFate
  }

  type DayState {
    id: ID!
    dateKey: String!
    afterDayCompletedAt: String
    actionGatheringCompletedAt: String
    preDayCompletedAt: String
  }

  "Action with overlap info for Pre-day overview (overlapIds = other action ids that overlap in time)."
  type ActionWithOverlap {
    action: Action!
    overlapIds: [ID!]!
  }

  "Pre-day status for a given date (today)."
  type PreDayStatus {
    afterDayRequired: Boolean!
    canAccessToday: Boolean!
    actionsWithoutTime: [Action!]!
    todayActionsWithOverlap: [ActionWithOverlap!]!
  }

  "Not-done actions for After-day wizard, grouped by how they are handled."
  type NotDoneActionsForDate {
    nonLinkedGathered: [Action!]!
    linkedGathered: [Action!]!
    standalone: [Action!]!
  }

  type Project {
    id: ID!
    title: String!
    dod: String
    type: String!
    priority: Priority!
    actions: [Action!]!
    intervals: [Interval!]!
    startDate: String
    endDate: String
    goal: Goal
    milestone: Milestone
  }

  type Goal {
    id: ID!
    title: String!
    dod: String
    isGoalGroup: Boolean!
    startDate: String
    endDate: String
    createdAt: String!
    parentGoalId: ID
    parentMilestoneId: ID
    parentGoal: Goal
    parentMilestone: Milestone
    childGoals: [Goal!]!
    milestones: [Milestone!]!
    projects: [Project!]!
    intervals: [Interval!]!
  }

  type Milestone {
    id: ID!
    title: String!
    doa: String
    goalId: ID!
    goal: Goal!
    childGoals: [Goal!]!
    projects: [Project!]!
    intervals: [Interval!]!
    predictionDate: String
    order: Int!
    isLast: Boolean!
  }

  type IntervalStep {
    id: ID!
    title: String!
    order: Int!
    createdAt: String!
  }

  type Interval {
    id: ID!
    title: String!
    status: IntervalStatus!
    estimatedTimeMinutes: Int!
    endTime: String
    repeatValue: Int!
    repeatUnit: RepeatUnit
    customRepeatDates: [String!]!
    customRepeatRule: String
    predictedToDoTime: String
    steps: [IntervalStep!]!
    goal: Goal
    milestone: Milestone
    project: Project
    createdAt: String!
    updatedAt: String!
  }

  type RoutineStep {
    id: ID!
    title: String!
    order: Int!
    createdAt: String!
  }

  type Routine {
    id: ID!
    title: String!
    status: IntervalStatus!
    estimatedTimeMinutes: Int!
    endTime: String
    timeOfDayBlocks: [String!]!
    timerDurationMinutes: Int
    steps: [RoutineStep!]!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String
    actions: [Action!]!
    projects: [Project!]!
    goals: [Goal!]!
    intervals: [Interval!]!
    routines: [Routine!]!
  }

  input ActionInput {
    title: String!
    tbd: String
    priority: Priority
    estimatedTimeMinutes: Int
  }

  input IntervalStepInput {
    title: String!
    order: Int
  }

  input RoutineStepInput {
    title: String!
    order: Int
  }

  type Query {
    actions: [Action!]!
    action(id: ID!): Action
    projects: [Project!]!
    project(id: ID!): Project
    goals(parentGoalId: ID, parentMilestoneId: ID, includeAll: Boolean): [Goal!]!
    goal(id: ID!): Goal
    intervals: [Interval!]!
    interval(id: ID!): Interval
    routines: [Routine!]!
    routine(id: ID!): Routine
    linkedActions(date: String!): [Action!]!
    standaloneActions(date: String!): [Action!]!
    dayState(date: String!): DayState
    "All actions for a day (linked + standalone + gathered for that date). Gathered for future dates are hidden."
    todayActions(date: String!): [Action!]!
    "Pre-day status: whether after-day is required for yesterday, and actions needing start time + overlap info."
    preDayStatus(date: String!): PreDayStatus!
    "Not-done actions for date, grouped for After-day wizard (non-linked gathered, linked gathered, standalone)."
    notDoneActionsForDate(date: String!): NotDoneActionsForDate!
    me: User
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type RunActionGatheringResult {
    dateKeysProcessed: [String!]!
    actionsCreated: Int!
  }

  type Mutation {
    addAction(title: String!, tbd: String, projectId: String, priority: Priority, estimatedTimeMinutes: Int, startTimeOfDay: String): Action!
    updateAction(id: ID!, title: String, tbd: String, done: Boolean, priority: Priority, estimatedTimeMinutes: Int, startTimeOfDay: String, actionFate: ActionFate, projectId: ID): Action!
    deleteAction(id: ID!): Action!

    addProject(
      title: String!
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
      priority: Priority
      actions: [ActionInput!]
    ): Project!
    updateProject(
      id: ID!
      title: String
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
      priority: Priority
    ): Project!
    deleteProject(id: ID!): Project!

    addGoal(title: String!, dod: String, isGoalGroup: Boolean, parentGoalId: ID, parentMilestoneId: ID): Goal!
    updateGoal(id: ID!, title: String, dod: String, isGoalGroup: Boolean, startDate: String, endDate: String, parentGoalId: ID, parentMilestoneId: ID): Goal!
    deleteGoal(id: ID!): Goal!

    addMilestone(goalId: ID!, title: String!, doa: String, predictionDate: String, isLast: Boolean): Milestone!
    updateMilestone(id: ID!, title: String, doa: String, predictionDate: String, order: Int, isLast: Boolean, goalId: ID): Milestone!
    deleteMilestone(id: ID!): Milestone!

    addInterval(
      title: String!
      estimatedTimeMinutes: Int!
      status: IntervalStatus
      endTime: String
      repeatValue: Int
      repeatUnit: RepeatUnit
      customRepeatDates: [String!]
      customRepeatRule: String
      predictedToDoTime: String
      steps: [IntervalStepInput!]
      goalId: ID
      milestoneId: ID
      projectId: ID
    ): Interval!
    updateInterval(
      id: ID!
      title: String
      estimatedTimeMinutes: Int
      status: IntervalStatus
      endTime: String
      repeatValue: Int
      repeatUnit: RepeatUnit
      customRepeatDates: [String!]
      customRepeatRule: String
      predictedToDoTime: String
      steps: [IntervalStepInput!]
      goalId: ID
      milestoneId: ID
      projectId: ID
    ): Interval!
    deleteInterval(id: ID!): Interval!

    addRoutine(
      title: String!
      estimatedTimeMinutes: Int!
      status: IntervalStatus
      endTime: String
      timeOfDayBlocks: [String!]
      timerDurationMinutes: Int
      steps: [RoutineStepInput!]
    ): Routine!
    updateRoutine(
      id: ID!
      title: String
      estimatedTimeMinutes: Int
      status: IntervalStatus
      endTime: String
      timeOfDayBlocks: [String!]
      timerDurationMinutes: Int
      steps: [RoutineStepInput!]
    ): Routine!
    deleteRoutine(id: ID!): Routine!

    toggleAction(id: ID!): Action!

    "Run action gathering for today, today+1, today+2 (skips dates already gathered). todayDate = local date YYYY-MM-DD."
    runActionGathering(todayDate: String!): RunActionGatheringResult!

    "Set action start time (Pre-day wizard)."
    setActionStartTime(id: ID!, startTimeOfDay: String!): Action!
    "Postpone action to a new date (After-day wizard)."
    postponeAction(id: ID!, newDate: String!): Action!
    "Outsource: create two actions (do outsourcing, ensure done) and mark original WOO."
    outsourceAction(id: ID!, doOutsourcingTitle: String!, doOutsourcingDate: String!, ensureDoneTitle: String!, ensureDoneDate: String!): Action!
    "Mark action as not important → Backlog (After-day, linked)."
    setActionNotImportant(id: ID!): Action!
    "Mark action as ignore → Bucket list (After-day, standalone)."
    setActionIgnore(id: ID!): Action!
    "Mark non-linked gathered action as passed/archived (After-day, auto or bulk)."
    setActionPassedArchived(id: ID!): Action!
    "Mark after-day as completed for date (sets afterDayCompletedAt)."
    completeAfterDay(date: String!): DayState!
    "Mark pre-day as completed for date (sets preDayCompletedAt); Today becomes accessible."
    completePreDay(date: String!): DayState!

    register(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;
