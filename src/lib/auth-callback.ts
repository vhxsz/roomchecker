import type { SupabaseClient, EmailOtpType } from "@supabase/supabase-js";

export async function completeAuthLink(supabase:SupabaseClient,url:URL){
 const query=url.searchParams,hash=new URLSearchParams(url.hash.slice(1));
 if(query.has("error")||hash.has("error"))throw new Error("This sign-in link is invalid or has expired. Request a new link.");
 const code=query.get("code"),tokenHash=query.get("token_hash"),type=query.get("type")||hash.get("type");
 if(code){
  const{error}=await supabase.auth.exchangeCodeForSession(code);
  if(error)throw error;
 }else if(tokenHash&&type&&["invite","email","signup","recovery","magiclink"].includes(type)){
  const{error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as EmailOtpType});
  if(error)throw error;
 }else if(hash.get("access_token")&&hash.get("refresh_token")){
  const{error}=await supabase.auth.setSession({access_token:hash.get("access_token")!,refresh_token:hash.get("refresh_token")!});
  if(error)throw error;
 }
 const{data,error}=await supabase.auth.getUser();
 if(error||!data.user)throw new Error("This sign-in link is incomplete or expired. Request a new link.");
 return {user:data.user,type};
}
