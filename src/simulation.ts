export type Service = 'FIRE' | 'POLICE' | 'MEDICAL';
export type IncidentStatus = 'WAITING' | 'DISPATCHED' | 'ON_SCENE' | 'RESOLVED';
export type UnitStatus = 'AVAILABLE' | 'RESPONDING' | 'ON_SCENE';
export type IncidentKind = 'STRUCTURE FIRE' | 'ROAD COLLISION' | 'MEDICAL EMERGENCY' | 'VEHICLE FIRE' | 'PUBLIC DISTURBANCE';
export interface CityBuilding { id:number; name:string; district:string; x:number; z:number; width:number; depth:number; floors:number; kind:string; condition:number; }
export interface ResponseUnit { id:string; service:Service; name:string; x:number; z:number; homeX:number; homeZ:number; status:UnitStatus; incidentId:number|null; }
export interface Incident { id:number; kind:IncidentKind; service:Service; buildingId:number; x:number; z:number; severity:1|2|3; status:IncidentStatus; age:number; responseTime:number; handling:number; }
export interface SimulationEvent { message:string; tone:'info'|'warning'|'success'; }
export interface SaveSnapshot { version:number; money:number; reputation:number; day:number; minutes:number; nextIncident:number; buildings:{id:number;condition:number}[]; incidents:Incident[]; units:{id:string;x:number;z:number;status:UnitStatus;incidentId:number|null}[]; }
export class CitySimulation {
  readonly buildings:CityBuilding[];
  readonly units:ResponseUnit[];
  readonly incidents:Incident[]=[];
  money=25000;
  reputation=72;
  totalResolved=0;
  totalFailed=0;
  day=1;
  minutes=8*60;
  elapsed=0;
  private nextIncident=1;
  private spawnTimer=0;
  private events:SimulationEvent[]=[];
  constructor(buildings:CityBuilding[]) {
    this.buildings=buildings;
    this.units=[
      this.unit('F-01','FIRE','Fire Engine 01',-25,-20),
      this.unit('F-02','FIRE','Fire Engine 02',-22,-20),
      this.unit('P-01','POLICE','Patrol Unit 01',20,-20),
      this.unit('P-02','POLICE','Patrol Unit 02',23,-20),
      this.unit('M-01','MEDICAL','Ambulance 01',-25,20),
      this.unit('M-02','MEDICAL','Ambulance 02',-22,20)
    ];
    this.spawn('STRUCTURE FIRE',2);
  }
  private unit(id:string,service:Service,name:string,x:number,z:number):ResponseUnit {
    return {id,service,name,x,z,homeX:x,homeZ:z,status:'AVAILABLE',incidentId:null};
  }
  private spawn(kind:IncidentKind,severity:1|2|3):void {
    const candidates=this.buildings.filter(b=>b.kind!=='STATION');
    const building=candidates[Math.floor(Math.random()*candidates.length)]!;
    const service:Service=kind==='STRUCTURE FIRE'||kind==='VEHICLE FIRE'?'FIRE':kind==='ROAD COLLISION'?'POLICE':'MEDICAL';
    const incident:Incident={id:this.nextIncident++,kind,service,buildingId:building.id,x:building.x,z:building.z,severity,status:'WAITING',age:0,responseTime:0,handling:0};
    this.incidents.unshift(incident);
    this.events.unshift({message:'NEW CALL · '+kind+' · '+building.district,tone:'warning'});
    if(this.incidents.length>40)this.incidents.pop();
  }
  createTestIncident():void {
    const choices:IncidentKind[]=['STRUCTURE FIRE','ROAD COLLISION','MEDICAL EMERGENCY','VEHICLE FIRE','PUBLIC DISTURBANCE'];
    this.spawn(choices[Math.floor(Math.random()*choices.length)]!,1+Math.floor(Math.random()*3) as 1|2|3);
  }
  dispatch(incidentId:number):boolean {
    const incident=this.incidents.find(i=>i.id===incidentId);
    if(!incident||incident.status!=='WAITING')return false;
    const candidates=this.units.filter(u=>u.service===incident.service&&u.status==='AVAILABLE');
    if(!candidates.length){this.events.unshift({message:'NO AVAILABLE '+incident.service+' UNITS',tone:'warning'});return false;}
    const unit=candidates.sort((a,b)=>Math.hypot(a.x-incident.x,a.z-incident.z)-Math.hypot(b.x-incident.x,b.z-incident.z))[0]!;
    if(this.money<150){this.events.unshift({message:'INSUFFICIENT OPERATING FUNDS · DISPATCH BLOCKED',tone:'warning'});return false;}
    this.money-=150;unit.status='RESPONDING';unit.incidentId=incident.id;incident.status='DISPATCHED';
    this.events.unshift({message:unit.name+' DISPATCHED TO CALL #'+incident.id,tone:'info'});
    return true;
  }
  tick(dt:number,speed:number):void {
    const step=dt*speed;this.elapsed+=step;this.minutes+=step*2.2;
    if(this.minutes>=1440){this.minutes-=1440;this.day++;}
    this.spawnTimer+=step;
    if(this.spawnTimer>=42&&this.incidents.filter(i=>i.status!=='RESOLVED').length<5){
      this.spawnTimer=0;
      const choices:IncidentKind[]=['STRUCTURE FIRE','ROAD COLLISION','MEDICAL EMERGENCY','VEHICLE FIRE','PUBLIC DISTURBANCE'];
      this.spawn(choices[Math.floor(Math.random()*choices.length)]!,1+Math.floor(Math.random()*2) as 1|2);
    }
    for(const incident of this.incidents){
      if(incident.status==='RESOLVED')continue;
      incident.age+=step;
      if(incident.status==='WAITING'&&incident.age>35&&incident.severity<3){
        incident.severity=(incident.severity+1) as 2|3;
        this.events.unshift({message:'CALL #'+incident.id+' ESCALATING · SEVERITY INCREASED',tone:'warning'});
      }
      if(incident.status==='WAITING'&&incident.age>95){this.fail(incident);continue;}
      if(incident.status==='DISPATCHED'&&incident.age>150){this.fail(incident);continue;}
      if(incident.status==='ON_SCENE'){
        incident.handling+=step;
        if(incident.handling>=Math.max(8,22-incident.severity*4))this.resolve(incident);
      }
    }
    for(const unit of this.units){
      if(!unit.incidentId)continue;
      const incident=this.incidents.find(i=>i.id===unit.incidentId);
      if(!incident||incident.status==='RESOLVED'){unit.incidentId=null;unit.status='AVAILABLE';unit.x=unit.homeX;unit.z=unit.homeZ;continue;}
      const dx=incident.x-unit.x,dz=incident.z-unit.z,distance=Math.hypot(dx,dz);
      if(distance>1.6){
        const travel=Math.min(distance,step*2.7);
        unit.x+=dx/distance*travel;unit.z+=dz/distance*travel;
        incident.responseTime+=step;
      }else if(incident.status==='DISPATCHED'){
        incident.status='ON_SCENE';unit.status='ON_SCENE';
        this.events.unshift({message:unit.name+' ARRIVED AT CALL #'+incident.id,tone:'success'});
      }
    }
  }
  private resolve(incident:Incident):void {
    incident.status='RESOLVED';
    const reward=incident.severity*450;
    this.totalResolved++;this.money+=reward;this.reputation=Math.min(100,this.reputation+1);
    const building=this.buildings.find(b=>b.id===incident.buildingId);
    if(building)building.condition=Math.min(100,building.condition+Math.max(2,10-incident.severity*2));
    const unit=this.units.find(u=>u.incidentId===incident.id);
    if(unit){unit.status='AVAILABLE';unit.incidentId=null;unit.x=unit.homeX;unit.z=unit.homeZ;}
    this.events.unshift({message:'CALL #'+incident.id+' RESOLVED · +$'+reward.toLocaleString(),tone:'success'});
  }

  private fail(incident:Incident):void {
    incident.status='RESOLVED';this.totalFailed++;
    const damage=incident.severity*13;
    const building=this.buildings.find(b=>b.id===incident.buildingId);
    if(building)building.condition=Math.max(0,building.condition-damage);
    const penalty=incident.severity*650;
    this.money=Math.max(0,this.money-penalty);
    this.reputation=Math.max(0,this.reputation-incident.severity*4);
    const unit=this.units.find(u=>u.incidentId===incident.id);
    if(unit){unit.status='AVAILABLE';unit.incidentId=null;unit.x=unit.homeX;unit.z=unit.homeZ;}
    this.events.unshift({message:'CALL #'+incident.id+' FAILED · DAMAGE AND COSTS INCURRED',tone:'warning'});
    if(incident.kind==='ROAD COLLISION'&&this.incidents.filter(i=>i.status!=='RESOLVED').length<5){
      this.spawn('MEDICAL EMERGENCY',Math.min(3,incident.severity) as 1|2|3);
      this.events.unshift({message:'SECONDARY INCIDENT · INJURY REPORT',tone:'warning'});
    }
  }
  get cityCondition():number {
    const active=this.buildings.filter(b=>b.kind!=='STATION');
    return Math.round(active.reduce((sum,b)=>sum+b.condition,0)/Math.max(1,active.length));
  }
  saveSnapshot():SaveSnapshot {
    return {version:1,money:this.money,reputation:this.reputation,day:this.day,minutes:this.minutes,nextIncident:this.nextIncident,buildings:this.buildings.map(b=>({id:b.id,condition:b.condition})),incidents:this.incidents,units:this.units.map(u=>({id:u.id,x:u.x,z:u.z,status:u.status,incidentId:u.incidentId}))};
  }
  loadSnapshot(data:SaveSnapshot):void {
    if(data.version!==1)return;
    this.money=Math.max(0,data.money);this.reputation=Math.max(0,Math.min(100,data.reputation));
    this.day=Math.max(1,data.day);this.minutes=data.minutes;this.nextIncident=Math.max(1,data.nextIncident);
    for(const saved of data.buildings){const building=this.buildings.find(b=>b.id===saved.id);if(building)building.condition=Math.max(0,Math.min(100,saved.condition));}
    this.incidents.splice(0,this.incidents.length,...data.incidents);
    for(const saved of data.units){const unit=this.units.find(u=>u.id===saved.id);if(unit){unit.x=saved.x;unit.z=saved.z;unit.status=saved.status;unit.incidentId=saved.incidentId;}}
  }
  get activeIncidents():Incident[]{return this.incidents.filter(i=>i.status!=='RESOLVED');}
  get availableUnits():number{return this.units.filter(u=>u.status==='AVAILABLE').length;}
  get recentEvents():SimulationEvent[]{return this.events.slice(0,6);}
  get timeLabel():string {const h=Math.floor(this.minutes/60)%24,m=Math.floor(this.minutes%60);return 'DAY '+String(this.day).padStart(2,'0')+' · '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}
}
