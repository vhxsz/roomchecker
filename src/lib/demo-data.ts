import type { CheckSession, Room, Student } from "./types";

export const students: Student[] = [
  { id:"KWC-2026-1042", name:"Mateo Silva", email:"mateo.silva@kingsway.college", age:17, grade:"Grade 12", nationality:"Brazilian", room:"B-214", floor:"Boys Dorm · Floor Two", initials:"MS", status:"photo_review" },
  { id:"KWC-2026-1043", name:"Liam Chen", email:"liam.chen@kingsway.college", age:16, grade:"Grade 11", nationality:"Canadian", room:"B-214", floor:"Boys Dorm · Floor Two", initials:"LC", status:"pending" },
  { id:"KWC-2026-1044", name:"Amara Okafor", email:"amara.okafor@kingsway.college", age:17, grade:"Grade 12", nationality:"Nigerian", room:"G-308", floor:"Girls Dorm · Floor Three", initials:"AO", status:"pending" },
  { id:"KWC-2026-1045", name:"Noah Williams", email:"noah.williams@kingsway.college", age:15, grade:"Grade 10", nationality:"American", room:"B-108", floor:"Boys Dorm · Floor One", initials:"NW", status:"verified" },
  { id:"KWC-2026-1046", name:"Ethan Park", email:"ethan.park@kingsway.college", age:16, grade:"Grade 11", nationality:"South Korean", room:"B-108", floor:"Boys Dorm · Floor One", initials:"EP", status:"verified" },
  { id:"KWC-2026-1047", name:"Lucas Meyer", email:"lucas.meyer@kingsway.college", age:17, grade:"Grade 12", nationality:"German", room:"B-216", floor:"Boys Dorm · Floor Two", initials:"LM", status:"absent" },
];

export const rooms: Room[] = [
  { id:"room-1", number:"B-214", hall:"Boys Dorm", floor:"Floor Two", capacity:2, checker:"Sarah Collins", students:["Mateo Silva","Liam Chen"] },
  { id:"room-2", number:"B-216", hall:"Boys Dorm", floor:"Floor Two", capacity:2, checker:"James Wilson", students:["Lucas Meyer"] },
  { id:"room-3", number:"B-108", hall:"Boys Dorm", floor:"Floor One", capacity:2, checker:"Daniel Morgan", students:["Noah Williams","Ethan Park"] },
  { id:"room-4", number:"G-308", hall:"Girls Dorm", floor:"Floor Three", capacity:2, checker:"Maya Thompson", students:["Amara Okafor"] },
];

export const sessions: CheckSession[] = [
  { id:"study", name:"Post-Worship Study Hall Check", time:"7:30 PM", days:"Sunday–Thursday", enabled:true },
  { id:"night", name:"Night Room Check", time:"10:00 PM", days:"Every day", enabled:true },
];
