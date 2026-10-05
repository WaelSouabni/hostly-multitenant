"use server";
import { z } from "zod";import { db } from "@/lib/prisma";import { requireHostTenant } from "@/lib/authz";
const schema=z.object({name:z.string().min(2),description:z.string().optional(),price:z.coerce.number().nonnegative(),unit:z.string().default("stay")});
export async function createStayOption(input:z.input<typeof schema>){const {tenant}=await requireHostTenant();const d=schema.parse(input);return db.stayOption.create({data:{...d,tenantId:tenant.id}});}
export async function listStayOptions(){const {tenant}=await requireHostTenant();return db.stayOption.findMany({where:{tenantId:tenant.id,isActive:true}});}