// Tiny stack VM — golfed single-loop core (@desember179).
import{mkdirSync as K,readdirSync as R,readFileSync as F,writeFileSync as W}from'node:fs';
import{join as J}from'node:path';
let I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output',
P='00011223xxxxxxxx222222212221222x222xxxxxxxxxxxxx01100xxxxxxxxxxx12xxxxxxxxxxxxxx1101',
Q='01102233xxxxxxxx111111111111111x111xxxxxxxxxxxxx00000xxxxxxxxxxx10xxxxxxxxxxxxxx0010',
B=[(a,b)=>a+b,(a,b)=>a-b,(a,b)=>Math.imul(a,b),(a,b)=>a/b,(a,b)=>a%b,(a,b)=>Math.floor((a>>>0)/(b>>>0)),(a,b)=>(a>>>0)%(b>>>0),(a,b)=>a&b,(a,b)=>a|b,(a,b)=>a^b,(a,b)=>a<<b,(a,b)=>a>>b,(a,b)=>a>>>b,(a,b)=>a==b?1:0,(a,b)=>a<b?1:0,(a,b)=>(a>>>0)<(b>>>0)?1:0];
function run(g,N){
let n=g.length,D=new Int32Array(256),s=0,C=new Int32Array(64),c=0,Y=new Int32Array(256),u=[],l=0,j=0,p=0,t=0,f=e=>({stdout:Buffer.from(u),exit:e});
for(;;){
if(t==1e6)return f(10);
if(p<0||p>=n)return f(9);
let o=g[p],w=P[o];
if(!w||w=='x')return f(5);
let q=+w,h=+Q[o],m=o==1?1:o==2?4:o>47&&o<52?2:0;
if(p+m>=n)return f(9);
t++;
let a=o==1?(g[p+1]<<24)>>24:o==2?g[p+1]|g[p+2]<<8|g[p+3]<<16|g[p+4]<<24:o>47&&o<51?((g[p+1]|g[p+2]<<8)<<16)>>16:o==51?g[p+1]|g[p+2]<<8:0,x=p+1+m;
if(s<q)return f(2);
if(s-q+h>256)return f(3);
p=x;
switch(o){
case 0:return f(0);
case 1:case 2:D[s++]=a;break;
case 3:s--;break;
case 4:D[s]=D[s-1];s++;break;
case 5:{let v=D[s-1];D[s-1]=D[s-2];D[s-2]=v;break}
case 6:D[s]=D[s-2];s++;break;
case 7:{let v=D[s-3];D[s-3]=D[s-2];D[s-2]=D[s-1];D[s-1]=v;break}
case 23:D[s-1]=-D[s-1];break;
case 27:D[s-1]=~D[s-1];break;
case 48:p=x+a;break;
case 49:if(!D[--s])p=x+a;break;
case 50:if(D[--s])p=x+a;break;
case 51:if(c==64)return f(7);C[c++]=x;p=a;break;
case 52:if(!c)return f(8);p=C[--c];break;
case 64:{let d=D[s-1];if(d<0||d>255)return f(6);D[s-1]=Y[d];break}
case 65:{let d=D[s-1];if(d<0||d>255)return f(6);Y[d]=D[s-2];s-=2;break}
case 80:{let v=String(D[s-1]);if(l+v.length>65536)return f(11);s--;for(let k=0;k<v.length;k++)u.push(v.charCodeAt(k));l+=v.length;break}
case 81:if(l+1>65536)return f(11);u.push(D[--s]&255);l++;break;
case 82:D[s++]=j<N.length?N[j++]:-1;break;
case 83:return f(D[--s]&255);
default:{let b=D[s-1];if(o>18&&o<23&&!b)return f(4);D[s-2]=B[o-16-(o>22)-(o>26)-(o>30)](D[s-2],b);s--}
}}}
for(let d of R(I,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort()){
let g,N;
try{g=F(J(I,d,'program.bin'))}catch{g=Buffer.alloc(0)}
try{N=F(J(I,d,'input.bin'))}catch{N=Buffer.alloc(0)}
let r=run(g,N);
K(J(O,d),{recursive:true});
W(J(O,d,'stdout.bin'),r.stdout);
W(J(O,d,'exit.txt'),r.exit+'\n');
}
