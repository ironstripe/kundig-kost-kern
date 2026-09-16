import { describe, it, expect } from "vitest";
import { calculateMenuTotals } from "@/lib/menu-totals";
const card:any={id:"c",vat_rate:8.1,small_material_mode:"percent",small_material_value:3,valid_from:"2026-01-01",valid_to:"2026-01-31",opening_weekdays:[1,2,3,4,5,6,0]};
const ing:any=[{id:"i",name:"X",package_quantity:1000,package_unit:"g",package_price:10,base_unit:"g",price_status:"confirmed",is_active:true}];
const mk=(id:string,active:boolean)=>({id,menu_card_id:"c",name:id,category_id:null,is_active:active} as any);
const mv=(id:string,dish:string,active:boolean)=>({id,dish_id:dish,name:id,gross_price:20,sales_input_mode:"total",expected_per_open_day:0,expected_total:100,calculation_status:"reviewed",is_active:active,small_material_override_mode:null,small_material_override_value:null} as any);
const item=(owner:any)=>({id:"it"+Math.random(),ingredient_id:"i",net_quantity:100,quantity_unit:"g",yield_percent:100,quantity_confirmed:true,...owner} as any);
const addOn=(id:string,active:boolean)=>({id,menu_card_id:"c",name:id,gross_price:5,sales_input_mode:"total",expected_per_open_day:0,expected_total:50,calculation_status:"reviewed",is_active:active,small_material_override_mode:null,small_material_override_value:null} as any);
function run(d:any,v:any,a:any,l:any,items:any){return calculateMenuTotals({card,dishes:d,variants:v,addOns:a,addOnLinks:l,items,ingredients:ing,excludedDays:[],categories:[]} as any);}
describe("eligibility",()=>{
 it("excludes inactive dish and its variants",()=>{
  const d=[mk("d1",true),mk("d2",false)];const v=[mv("v1","d1",true),mv("v2","d2",true)];
  const items=[item({variant_id:"v1"}),item({variant_id:"v2"})];
  const r=run(d,v,[],[],items);
  const keys=r.lines.filter(l=>l.isActive).map(l=>l.key);
  expect(keys).toEqual(["v:v1"]);
 });
 it("add-on needs one qualifying assignment, counted once",()=>{
  const d=[mk("d1",true),mk("d2",true)];const v=[mv("v1","d1",true),mv("v2","d2",true)];
  const a=[addOn("a1",true),addOn("a2",true)];
  const l=[{id:"l1",dish_id:"d1",add_on_id:"a1"},{id:"l2",dish_id:"d2",add_on_id:"a1"}] as any;
  const items=[item({variant_id:"v1"}),item({variant_id:"v2"}),item({add_on_id:"a1"}),item({add_on_id:"a2"})];
  const r=run(d,v,a,l,items);
  expect(r.lines.filter(x=>x.key==="a:a1").length).toBe(1);
  expect(r.lines.find(x=>x.key==="a:a1")!.isActive).toBe(true);
  const a2=r.lines.find(x=>x.key==="a:a2")!;
  expect(a2.isActive).toBe(false);
  expect(a2.eligibilityNote).toMatch(/keinem Gericht/);
 });
 it("add-on drops out when last qualifying dish is inactive",()=>{
  const d=[mk("d1",false)];const v=[mv("v1","d1",true)];
  const a=[addOn("a1",true)];const l=[{id:"l1",dish_id:"d1",add_on_id:"a1"}] as any;
  const items=[item({variant_id:"v1"}),item({add_on_id:"a1"})];
  const r=run(d,v,a,l,items);
  const line=r.lines.find(x=>x.key==="a:a1")!;
  expect(line.isActive).toBe(false);
  expect(line.eligibilityNote).toMatch(/keine aktive Gerichtzuordnung/);
 });
});
