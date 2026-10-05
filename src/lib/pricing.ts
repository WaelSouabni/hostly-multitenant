import { Prisma } from "@prisma/client";
type Rule={startDate:Date|null;endDate:Date|null;weekdays:number[];nightlyRate:Prisma.Decimal|null;multiplier:Prisma.Decimal|null;minNights:number|null;priority:number;isActive:boolean};
export function getNightRate(base:Prisma.Decimal|number,rules:Rule[],date:Date,nights:number){
 const active=rules.filter(r=>r.isActive&&(!r.startDate||date>=r.startDate)&&(!r.endDate||date<=r.endDate)&&(r.weekdays.length===0||r.weekdays.includes(date.getUTCDay()))&&(!r.minNights||nights>=r.minNights)).sort((a,b)=>b.priority-a.priority);
 const r=active[0]; if(!r)return new Prisma.Decimal(base); if(r.nightlyRate)return r.nightlyRate;if(r.multiplier)return new Prisma.Decimal(base).mul(r.multiplier);return new Prisma.Decimal(base);
}
export function calculateStay(a:{baseRate:Prisma.Decimal;rules:Rule[];checkIn:Date;checkOut:Date;cleaningFee:Prisma.Decimal;optionTotals?:Prisma.Decimal;discount?:Prisma.Decimal;touristTax?:Prisma.Decimal}){
 const nights=Math.ceil((a.checkOut.getTime()-a.checkIn.getTime())/86400000);if(nights<=0)throw new Error("INVALID_DATES");
 let subtotal=new Prisma.Decimal(0);for(let i=0;i<nights;i++){const d=new Date(a.checkIn);d.setUTCDate(d.getUTCDate()+i);subtotal=subtotal.add(getNightRate(a.baseRate,a.rules,d,nights));}
 const discount=a.discount??new Prisma.Decimal(0),options=a.optionTotals??new Prisma.Decimal(0),tax=a.touristTax??new Prisma.Decimal(0),total=subtotal.add(a.cleaningFee).add(options).add(tax).sub(discount);
 return {nights,subtotal,discount,cleaningFee:a.cleaningFee,optionTotals:options,touristTax:tax,total:total.greaterThan(0)?total:new Prisma.Decimal(0)};
}