export const escapeSegment=(s:string)=>s.replace(/~/g,'~0').replace(/\//g,'~1').replace(/\[/g,'~2').replace(/\]/g,'~3').replace(/#/g,'~4');
export const unescapeSegment=(s:string)=>s.replace(/~([0-4])/g,(_,n)=>['~','/','[',']','#'][Number(n)]);
