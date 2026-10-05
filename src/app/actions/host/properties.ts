"use server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { requireHostTenant } from "@/lib/authz";

const propertySchema = z.object({
  name: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(["STUDIO","GUEST_HOUSE","APARTMENT","HOUSE"]), shortDescription: z.string().trim().max(240).optional(),
  description: z.string().trim().max(5000).optional(), address: z.string().trim().max(240).optional(),
  city: z.string().trim().max(100).optional(), country: z.string().trim().length(2).default("FR"),
  maxGuests: z.coerce.number().int().min(1).max(100), bedrooms: z.coerce.number().int().min(0).max(100),
  bathrooms: z.coerce.number().int().min(0).max(100), baseNightlyRate: z.coerce.number().positive(),
  cleaningFee: z.coerce.number().min(0).default(0),
});
export async function listProperties(){const {tenant}=await requireHostTenant();return db.property.findMany({where:{tenantId:tenant.id},include:{images:{orderBy:{sortOrder:"asc"}}},orderBy:{createdAt:"desc"}});}
export async function createProperty(input:z.input<typeof propertySchema>){const {tenant}=await requireHostTenant();const data=propertySchema.parse(input);if(await db.property.findUnique({where:{tenantId_slug:{tenantId:tenant.id,slug:data.slug}}}))throw new Error("SLUG_ALREADY_EXISTS");return db.property.create({data:{...data,tenantId:tenant.id}});}
export async function updateProperty(id:string,input:z.input<typeof propertySchema>){const {tenant}=await requireHostTenant();const data=propertySchema.parse(input);const property=await db.property.findFirst({where:{id,tenantId:tenant.id}});if(!property)throw new Error("PROPERTY_NOT_FOUND");if(await db.property.findFirst({where:{tenantId:tenant.id,slug:data.slug,NOT:{id}}}))throw new Error("SLUG_ALREADY_EXISTS");return db.property.update({where:{id},data});}
export async function deleteProperty(id:string){const {tenant}=await requireHostTenant();const property=await db.property.findFirst({where:{id,tenantId:tenant.id},select:{id:true}});if(!property)throw new Error("PROPERTY_NOT_FOUND");if(await db.booking.count({where:{propertyId:id,status:{in:["PENDING","CONFIRMED"]}}}))throw new Error("PROPERTY_HAS_ACTIVE_BOOKINGS");await db.property.delete({where:{id}});return {ok:true};}
export async function setPropertyPublished(id:string,isPublished:boolean){const {tenant}=await requireHostTenant();const p=await db.property.findFirst({where:{id,tenantId:tenant.id}});if(!p)throw new Error("PROPERTY_NOT_FOUND");if(isPublished&&p.baseNightlyRate.lessThanOrEqualTo(0))throw new Error("PROPERTY_NOT_READY");await db.property.update({where:{id},data:{isPublished}});return {ok:true};}
export async function setPropertyActive(id:string,isActive:boolean){const {tenant}=await requireHostTenant();const r=await db.property.updateMany({where:{id,tenantId:tenant.id},data:{isActive}});if(!r.count)throw new Error("PROPERTY_NOT_FOUND");return {ok:true};}
export async function addPropertyImage(propertyId:string,input:{url:string;alt?:string}){const {tenant}=await requireHostTenant();const url=z.string().url().max(2000).parse(input.url);if(!await db.property.findFirst({where:{id:propertyId,tenantId:tenant.id}}))throw new Error("PROPERTY_NOT_FOUND");const last=await db.propertyImage.findFirst({where:{propertyId},orderBy:{sortOrder:"desc"}});return db.propertyImage.create({data:{propertyId,url,alt:input.alt?.trim().slice(0,200),sortOrder:(last?.sortOrder??-1)+1}});}
export async function deletePropertyImage(id:string){const {tenant}=await requireHostTenant();const image=await db.propertyImage.findFirst({where:{id,property:{tenantId:tenant.id}}});if(!image)throw new Error("IMAGE_NOT_FOUND");await db.propertyImage.delete({where:{id}});return {ok:true};}
export async function reorderPropertyImages(propertyId:string,imageIds:string[]){const {tenant}=await requireHostTenant();if(!await db.property.findFirst({where:{id:propertyId,tenantId:tenant.id}}))throw new Error("PROPERTY_NOT_FOUND");const images=await db.propertyImage.findMany({where:{propertyId},select:{id:true}});if(images.length!==imageIds.length||images.some(i=>!imageIds.includes(i.id)))throw new Error("INVALID_IMAGE_ORDER");await db.$transaction(imageIds.map((id,index)=>db.propertyImage.update({where:{id},data:{sortOrder:index}})));return {ok:true};}
