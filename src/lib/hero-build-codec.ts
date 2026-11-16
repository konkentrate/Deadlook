import { Zstd } from './zstd-vendor.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let zstdPromise: Promise<any> | undefined;
const zstd = () => zstdPromise ??= Zstd.load();

export interface WorkshopItem { itemId: number; annotation: string; flex?: boolean; sellPriority?: number; imbueTarget?: number; }
export interface WorkshopCategory { name: string; description: string; width: number; height: number; optional?: boolean; items: WorkshopItem[]; }
export interface WorkshopBuild { heroId: number; name: string; description: string; categories: WorkshopCategory[]; /** Opaque Details_V0 ability-order payload retained during import/export. */ abilityOrder?: number[]; }

function varint(value: number): number[] {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid protobuf integer');
  const bytes: number[] = [];
  do { let b = value % 128; value = Math.floor(value / 128); if (value) b |= 128; bytes.push(b); } while (value);
  return bytes;
}
function field(n: number, data: number[]) { return [...varint(n * 8 + 2), ...varint(data.length), ...data]; }
function text(n: number, s: string) { return field(n, [...encoder.encode(s)]); }
function integer(n: number, v: number) { return [...varint(n * 8), ...varint(v)]; }
function float32(n: number, v: number) { const bytes=new Uint8Array(4);new DataView(bytes.buffer).setFloat32(0,v,true);return [...varint(n*8+5),...bytes]; }
function msg(...parts: number[][]) { return parts.flat(); }
function itemBytes(item: WorkshopItem) {
  return msg(integer(1, item.itemId), ...(item.annotation ? [text(2, item.annotation)] : []), ...(item.flex ? [integer(3, 1)] : []), ...(item.sellPriority ? [integer(4, item.sellPriority)] : []), ...(item.imbueTarget ? [integer(5, item.imbueTarget)] : []));
}
function categoryBytes(category: WorkshopCategory) {
  const data = msg(...category.items.map(i => field(1, itemBytes(i))), text(2, category.name), ...(category.description ? [text(3, category.description)] : []), float32(4, category.width), float32(5, category.height), ...(category.optional ? [integer(6, 1)] : []));
  return field(1, data);
}
function base64(bytes: Uint8Array) { let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary); }
function unbase64(input: string) { const bytes=Uint8Array.from(atob(input.replace(/\s/g,'')),c=>c.charCodeAt(0)); return bytes; }
function readVarint(bytes: Uint8Array, cursor: {p:number}) { let value=0,mul=1; while(cursor.p<bytes.length){const b=bytes[cursor.p++];value+=(b&127)*mul;if(!(b&128))return value;mul*=128;} throw new Error('Truncated protobuf varint'); }
function parse(bytes: Uint8Array) { const fields:{n:number;w:number;v:number|Uint8Array}[]=[];const c={p:0};while(c.p<bytes.length){const tag=readVarint(bytes,c),n=Math.floor(tag/8),w=tag%8;if(!n)throw new Error('Invalid protobuf field number');if(w===0)fields.push({n,w,v:readVarint(bytes,c)});else if(w===2){const len=readVarint(bytes,c),end=c.p+len;if(end>bytes.length)throw new Error('Truncated protobuf field');fields.push({n,w,v:bytes.slice(c.p,end)});c.p=end;}else if(w===1||w===5){const size=w===1?8:4,end=c.p+size;if(end>bytes.length)throw new Error('Truncated protobuf field');fields.push({n,w,v:bytes.slice(c.p,end)});c.p=end;}else throw new Error('Unsupported protobuf wire type');}return fields; }
const get=(fields:ReturnType<typeof parse>,n:number,w=2)=>fields.find(f=>f.n===n&&f.w===w)?.v;
const float=(fields:ReturnType<typeof parse>,n:number)=>{const value=get(fields,n,5);return value instanceof Uint8Array&&value.length===4?new DataView(value.buffer,value.byteOffset,4).getFloat32(0,true):undefined;};
const str=(fields:ReturnType<typeof parse>,n:number)=>{const v=get(fields,n);return v instanceof Uint8Array?decoder.decode(v):'';};

export async function encodeBuild(build: WorkshopBuild): Promise<string> {
  const details = field(10, msg(...build.categories.map(categoryBytes), ...(build.abilityOrder ? [field(2, build.abilityOrder)] : [])));
  // New clipboard builds use the client-side placeholder ID used by Build Swap;
  // the game assigns the real identity when the player saves/publishes in-client.
  const raw = new Uint8Array(msg(integer(1,1),integer(2,build.heroId),integer(4,Math.floor(Date.now()/1000)),text(5,build.name),text(6,build.description),details));
  return base64((await zstd()).compress(raw, 19));
}
export async function decodeBuild(code: string): Promise<WorkshopBuild> {
  if(code.length>200_000)throw new Error('Build code is too large.');
  let compressed: Uint8Array; try { compressed=unbase64(code); } catch { throw new Error('Enter a valid base64 build code.'); }
  if(compressed.length<4||compressed[0]!==0x28||compressed[1]!==0xb5||compressed[2]!==0x2f||compressed[3]!==0xfd)throw new Error('This is not a supported Deadlock build code (missing Zstandard header).');
  const raw: Uint8Array=(await zstd()).decompress(compressed);
  if(raw.length>2_000_000)throw new Error('Decompressed build data is too large.');
  const top=parse(raw), hero=get(top,2,0); if(typeof hero!=='number')throw new Error('Build code does not contain a hero ID.');
  const details=get(top,10);const cats:WorkshopCategory[]=[];let abilityOrder:number[]|undefined;
  if(details instanceof Uint8Array){for(const f of parse(details)){if(f.n===2&&f.v instanceof Uint8Array){abilityOrder=Array.from(f.v);continue;}if(f.n!==1||!(f.v instanceof Uint8Array))continue;const c=parse(f.v);const items:WorkshopItem[]=[];for(const m of c.filter(x=>x.n===1&&x.v instanceof Uint8Array)){const mf=parse(m.v as Uint8Array),id=get(mf,1,0);if(typeof id==='number')items.push({itemId:id,annotation:str(mf,2),...(get(mf,3,0)===1?{flex:true}:{}),...(typeof get(mf,4,0)==='number'?{sellPriority:get(mf,4,0) as number}:{}),...(typeof get(mf,5,0)==='number'?{imbueTarget:get(mf,5,0) as number}:{})});}cats.push({name:str(c,2),description:str(c,3),width:Number(float(c,4)||1),height:Number(float(c,5)||1),...(get(c,6,0)===1?{optional:true}:{}),items});}}
  return {heroId:hero,name:str(top,5),description:str(top,6),categories:cats,...(abilityOrder?{abilityOrder}:{})};
}
export const codecWarmup = () => zstd();
