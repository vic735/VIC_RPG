/** Static definitions stay separate from mutable run/battle/save data. IDs are stable save references. */
export type Stat = 'hp' | 'stamina' | 'mana' | 'agility' | 'luck';
export type Stats = Record<Stat, number>;
export type Slot = 'head' | 'chest' | 'arms' | 'feet' | 'weapon';
export interface StatGrowth { base: number; perLevel: number; bonusRate: number }
export type Element = 'metal' | 'wood' | 'water' | 'fire' | 'earth' | 'light' | 'dark';
export type Resource = 'hp' | 'stamina' | 'mana';
export type Effect =
 | { type: 'interrupt'; chance?: number }
 | { type: 'status'; status: StatusDefinition }
 | { type: 'restore'; resource: Resource; amount: number }
 | { type: 'recover'; resource: Resource; ratio: number }
 | { type: 'heal' | 'echo' | 'refund' | 'shield'; ratio: number }
 | { type: 'refresh'; id: string }
 | { type: 'preventInterrupt' }
 | { type: 'survive'; luckRate: number; cap: number };
export interface MoveDefinition {
  id: string; name: string; kind: 'normal' | 'ultimate';
  damageType: 'physical' | 'magic' | 'spell'; elements: Element[]; tags: string[]; hits: number; originalAttackTime: number; subtitle?: string; multiplier: number;
  cost: Partial<Pick<Stats, 'stamina' | 'mana'>>; attackTime: number;
  effects: Effect[];
  /** Actual ultimate energy needed when this existing move occupies the ultimate slot. */
  ultimateChargeCost: number;
  minCastTime: number;
  upgrades?: { level: number; multiplier?: number; effects?: Effect[] }[];
}
export interface StatModifier { stat: Stat; target: 'base' | 'perLevel' | 'bonusRate'; amount: number }
export interface PassiveDefinition {
  id: string; name: string;
  levels: { level: number; modifiers: StatModifier[];
    triggers: { on: 'critical' | 'dodge' | 'castComplete' | 'levelUp'; effects: Effect[] }[] }[];
}
export interface EquipmentDefinition { id: string; name: string; slot: Slot; modifiers: Partial<Stats>; weaponType?: 'sword' | 'bow' | 'blunt'; hooks?: SkillHook[] }
export interface Build { talents: string[]; moves: string[]; ultimate: string | null; equipment: Record<Slot, string | null> }
/** Legacy v1 contract retained for migration reference; never persisted by the v2 slice. */
export interface Profile {
  schemaVersion: 1;
  unlocked: Record<'talents' | 'moves' | 'ultimates' | 'equipment' | 'weapons', Record<string, number>>;
  achievementIds: string[];
}
export interface BattleRunState {
  schemaVersion: 1; level: number; exp: number; deaths: number;
  debuffIds: string[]; status: 'active' | 'failed' | 'won';
}
export interface CastState { moveId: string; startedAt: number; endAt: number; duration: number }
export interface ActorState { id: string; stats: Stats; hp: number; stamina: number; mana: number; cast: CastState | null; statuses: Record<string, StatusState>; elements: Element[]; shield: number }
export interface RegionDefinition { id: string; name: string; edgeLevels: [number, number]; coreLevels: [number, number] }
export interface DungeonDefinition { id: string; level: number; encounters: [string, string, string, string]; bossScaling: 'undecided' | 'level' | 'stats' }
/** Unresolved formulas are injected policies, never implicitly derived from luck/agility. */
export interface FutureCombatRules {
  dodgeChance(actor: ActorState): number;
  critChance(actor: ActorState): number;
  critMultiplier(actor: ActorState): number;
  experienceMultiplier(actor: ActorState): number;
  damage(actor: ActorState, target: ActorState, move: MoveDefinition): number;
}

/** Runtime data contracts for the v2 vertical slice. Static definitions use stable string IDs. */
export interface PermanentProgress {
  schemaVersion: 2;
  skills: string[];
  moves: Record<string, number>; // integer permanent mastery 1..3
  ultimates: string[];
  books: string[];
  equipment: string[]; // armor and weapons resolved by EquipmentDefinition.slot
  completions: number; dungeonCompletions?: Record<string, number>;
}
export interface Position { x: number; y: number }
export interface WorldEnemy extends Position {
  id: string; type: string; level: number; homeX: number; homeY: number;
  discovered: boolean; defeatedUntil: number; alert?: boolean; elite?: boolean; regionId?: string;
}
export interface RunLoot {kind: RewardKind;id:string;count:number;isNew:boolean;before?:number;after?:number}
export interface RunState {
  loot: Record<string,RunLoot>;lootHistoryPartial?:boolean;ultimateCharge:number;
  schemaVersion: 2;
  level: number; exp: number; points: number; allocated: Stats; // points remains 0; allocated retains legacy bonuses only
  deaths: number; debuffIds: string[]; status: 'active' | 'failed';
  pendingAcquisitions?: AcquisitionTicket[];
  moveLevels: Record<string, number>; // no hard cap, copied from permanent levels on new run
  build: Build; position: Position;
  world: { time: number; enemies: WorldEnemy[]; discoveredDungeons: string[]; usedObjects?: string[]; inventory?: string[] };
  dungeon: { id: string; stage: number; rewardClaimed?: boolean; rewardCombination?: string } | null; // indexed by DungeonData.enemyWaves
}
export interface SkillContent {
  id: string; name: string; icon: string; description: string;
  modifiers: Partial<Stats>; growthRates?: Partial<Stats>;
}
export interface EquipmentContent {
  id: string; name: string; slot: Slot; icon: string; description: string;
  modifiers: Partial<Stats>;
  onDodgeShorten?: number; physicalMultiplier?: number; physicalAttackTime?: number;
}
export interface MonsterContent {
  id: string; name: string; behavior: 'neutral' | 'active' | 'guard' | 'timid';
  stats: Stats; moves: string[]; color: string; radius: number; speed: number;
}
export interface BookContent {
  id: string; name: string; moveId: string; description: string;
  requirement: { moveId: string; level: number };
}
export interface CombatEvent {
  time: number; type: 'start' | 'cast' | 'damage' | 'dodge' | 'interrupt' | 'victory' | 'revive' | 'death' | 'skill' | 'afterimage' | 'miss';
  text: string; actorId?: 'player' | 'enemy'; targetId?: 'player' | 'enemy';
  moveId?: string; damage?: number; critical?: boolean;
}

/** Consumed once on equip or skip; never authorizes general in-run editing. */
export interface AcquisitionTicket { kind: "moves" | "talents"; id: string }
export interface AudioSettings { sound: boolean; volume: number; reducedMotion: boolean; contrast: boolean }

export interface ExplorationObject extends Position { id: string; kind: "npc" | "chest" | "investigate" | "gather"; name: string; action: string; text: string; once?: boolean; reward?: string }

export interface Condition {
 damageType?: 'physical' | 'magic' | 'spell'; element?: Element; weapon?: string;
 tag?: string; anyTag?: string[]; originalTimeLt?: number; originalTimeGte?: number;
 targetCasting?: boolean; targetStatus?: string; targetDebuff?: boolean;
 resource?: Resource; ratioLt?: number; ratioGt?: number; critical?: boolean;
 primary?: boolean; alive?: boolean; totalDamagePositive?: boolean;
 spent?: Resource; healing?: boolean; successfulSupport?: boolean;
}
export interface CombatModifier { stage: string; op?: 'add' | 'multiply'; value?: number; perInjury?: number; conditions?: Condition }
export interface StatusDefinition {
 id: string; name: string; duration: number; target?: 'self' | 'enemy'; polarity?: 'buff' | 'debuff';
 modifiers: CombatModifier[]; consume?: 'physical' | 'magic' | 'spell'; strength?: number;
 tick?: { interval: number; ratio: number; stat: Stat };
}
export interface StatusState extends StatusDefinition { expiresAt: number; sourceId: string; nextTick: number; tickDamage?: number }
export type SkillEvent = 'OnBattleStart' | 'OnBattleEnd' | 'OnSkillCastStart' | 'OnSkillCastFinished' | 'OnPhysicalSkillFinished' | 'OnMagicSkillFinished' | 'OnSpellFinished' | 'OnDamageDealt' | 'OnDamageTaken' | 'OnCriticalHit' | 'OnDodge' | 'OnInterruptSuccess' | 'OnInterruptReceived' | 'OnResourceSpent' | 'OnResourceRecovered' | 'OnHPChanged' | 'OnStatusApplied' | 'OnLevelUp' | 'OnEXPReceived' | 'OnLethalDamage';
export interface SkillHook { event: SkillEvent; conditions: Condition; effects: Effect[]; once?: boolean }
export interface SkillDefinition {
 id: string; name: string; description: string; category: string; rarity: string;
 triggerType: string; conditions: Condition; effects: Effect[]; parameters: Record<string, unknown>;
 icon: string; tags: string[]; modifiers: Partial<Stats>; growthRates?: Partial<Stats>;
 statRates?: Partial<Stats>; baseOnly?: boolean; combatModifiers?: CombatModifier[]; hooks?: SkillHook[];
}

export type RewardKind = 'moves' | 'talents' | 'equipment' | 'books';
export interface RegionData { id: string; name: string; recommendedLevelMin: number; recommendedLevelMax: number; bounds: [number,number,number,number]; x:number; y:number; subAreaLevelRanges: {id:string;name:string;min:number;max:number}[]; enemyPools:string[];elitePools:string[];dungeonIds:string[];visualTheme:string;color:string;description:string }
export interface EnemySpawnData extends Position { id:string;regionId:string;type:string;level?:number;elite?:boolean;levelBonus?:number }
export interface DungeonWave {role:'normal'|'elite'|'boss';type:string;level:number}
export interface RewardPoolEntry {rewardType:RewardKind;rewardIds:string[];weight:number;requirements:{minLevel?:number};rarity:string}
export interface RewardPoolData {id:string;entries:RewardPoolEntry[]}
export interface DungeonRewardCombinationData {id:string;weight:number;draws:{pool:string;type?:RewardKind}[]}
export interface DungeonData extends Position {id:string;name:string;regionId:string;recommendedLevel:number;dungeonType:'standard'|'short'|'deep';enemyWaves:DungeonWave[];bossId:string;primaryRewardPool:string;secondaryRewardPool:string;rareRewardPool:string;rewardCombinationRules:DungeonRewardCombinationData[];features:string[];rewardTypes:string[]}
export interface WorldReward {kind:RewardKind;id:string;rarity:string;poolId:string;isNew?:boolean;before?:number;after?:number}

export interface ExperienceReward {amount:number;levels:number;beforeLevel:number;afterLevel:number;beforeStats:Stats;afterStats:Stats}
export interface AdventureBalance {version:number;baseStats:Stats;growth:Stats}
