export const SCHOOL_SIGN_IN_MESSAGE="Use your @kingsway.college Google account to sign in.";
export function isSchoolEmail(email:unknown):email is string {
 return typeof email==="string"&&/^[^\s@]+@kingsway\.college$/i.test(email);
}
type SchoolUser={email?:string;identities?:{provider:string;identity_data?:{[key:string]:unknown}}[]};
// Server callers must first authenticate this JWT using Supabase getUser(token).
// Decoding below checks its authentication method, not its signature.
export function isSchoolGoogleSession(user:SchoolUser,token:string):boolean {
 if(!isSchoolEmail(user.email))return false;
 const google=user.identities?.some(i=>i.provider==="google"&&i.identity_data?.email_verified===true&&String(i.identity_data?.email??"").toLowerCase()===user.email!.toLowerCase());
 if(!google)return false;
 try{
  const claims=JSON.parse(atob(token.split(".")[1].replaceAll("-","+").replaceAll("_","/")));
  return Array.isArray(claims.amr)&&claims.amr.some((item:{method?:string})=>item.method==="oauth");
 }catch{return false;}
}
