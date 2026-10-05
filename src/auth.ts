import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { db } from "@/lib/prisma";
export const { handlers, auth, signIn, signOut } = NextAuth({
 adapter:PrismaAdapter(db),session:{strategy:"jwt"},pages:{signIn:"/login"},
 providers:[Credentials({credentials:{email:{label:"Email",type:"email"},password:{label:"Mot de passe",type:"password"}},async authorize(credentials){
  const email=String(credentials?.email??"").trim().toLowerCase(),password=String(credentials?.password??"");
  if(!email||!password)return null;const user=await db.user.findUnique({where:{email},include:{tenant:true}});
  if(!user?.passwordHash||!(await compare(password,user.passwordHash)))return null;
  if(user.role==="HOST"&&user.tenant?.status!=="ACTIVE")return null;
  return {id:user.id,name:user.name,email:user.email,role:user.role,tenantId:user.tenantId};
 })],
 callbacks:{
  async jwt({token,user}){if(user){token.sub=user.id;token.role=user.role;token.tenantId=user.tenantId;}return token;},
  async session({session,token}){if(session.user){session.user.id=token.sub!;session.user.role=token.role as any;session.user.tenantId=(token.tenantId as string|null|undefined)??null;}return session;},
  authorized({auth,request}){const p=request.nextUrl.pathname;if(p.startsWith("/super-admin"))return auth?.user?.role==="SUPER_ADMIN";if(p.startsWith("/host"))return auth?.user?.role==="HOST";return true;}
 }
});