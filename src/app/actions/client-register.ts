"use server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/security";

const schema=z.object({name:z.string().trim().min(2).max(120),email:z.string().email(),password:z.string().min(8).max(128)});
export async function registerClient(input:z.input<typeof schema>){
  const data=schema.parse(input); const email=data.email.toLowerCase();
  const rate=await consumeRateLimit(`register:${email}`,3,60*60*1000); if(!rate.allowed) throw new Error("TOO_MANY_ATTEMPTS");
  const existing=await db.user.findUnique({where:{email}}); if(existing) throw new Error("EMAIL_ALREADY_USED");
  const passwordHash=await hash(data.password,12);
  await db.user.create({data:{name:data.name,email,passwordHash,role:"CLIENT"}});
  return {ok:true};
}