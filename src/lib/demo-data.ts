import type { CheckSession, Room, Student } from "./types";

export const students: Student[] = [
  { id:"KWC-2026-1042", name:"Mateo Silva", email:"mateo.silva@kingsway.college", age:17, grade:"Grade 12", nationality:"Brazilian", room:"N-214", floor:"North · 2", initials:"MS", status:"photo_review" },
  { id:"KWC-2026-1043", name:"Liam Chen", email:"liam.chen@kingsway.college", age:16, grade:"Grade 11", nationality:"Canadian", room:"N-214", floor:"North · 2", initials:"LC", status:"pending" },
  { id:"KWC-2026-1044", name:"Amara Okafor", email:"amara.okafor@kingsway.college", age:17, grade:"Grade 12", nationality:"Nigerian", room:"S-221", floor:"South · 2", initials:"AO", status:"pending" },
  { id:"KWC-2026-1045", name:"Noah Williams", email:"noah.williams@kingsway.college", age:15, grade:"Grade 10", nationality:"American", room:"S-108", floor:"South · 1", initials:"NW", status:"verified" },
  { id:"KWC-2026-1046", name:"Ethan Park", email:"ethan.park@kingsway.college", age:16, grade:"Grade 11", nationality:"South Korean", room:"S-108", floor:"South · 1", initials:"EP", status:"verified" },
  { id:"KWC-2026-1047", name:"Lucas Meyer", email:"lucas.meyer@kingsway.college", age:17, grade:"Grade 12", nationality:"German", room:"N-209", floor:"North · 2", initials:"LM", status:"absent" },
];

export const rooms: Room[] = [
  { id:"room-1", number:"N-214", hall:"North Hall", floor:"2nd floor", capacity:2, checker:"Sarah Collins", students:["Mateo Silva","Liam Chen"] },
  { id:"room-2", number:"N-209", hall:"North Hall", floor:"2nd floor", capacity:2, checker:"Sarah Collins", students:["Lucas Meyer"] },
  { id:"room-3", number:"S-108", hall:"South Hall", floor:"1st floor", capacity:2, checker:"James Wilson", students:["Noah Williams","Ethan Park"] },
  { id:"room-4", number:"S-221", hall:"South Hall", floor:"2nd floor", capacity:2, checker:"Maya Thompson", students:["Amara Okafor"] },
];

export const sessions: CheckSession[] = [
  { id:"study", name:"Post-Worship Study Hall Check", time:"7:30 PM", days:"Sunday–Thursday", enabled:true },
  { id:"night", name:"Night Room Check", time:"10:00 PM", days:"Every day", enabled:true },
];
