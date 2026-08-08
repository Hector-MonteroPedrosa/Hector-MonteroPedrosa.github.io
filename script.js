/* =========================================================================
   WEBBLENDER - Recreación de Blender para navegador (modelado + preview)
   ========================================================================= */

/* -------------------------------------------------------------------------
   1. UTILIDADES VECTORIALES
   ------------------------------------------------------------------------- */
function v3sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function v3add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function v3scale(a,s){return [a[0]*s,a[1]*s,a[2]*s];}
function v3cross(a,b){return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];}
function v3dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function v3len(a){return Math.hypot(a[0],a[1],a[2]);}
function v3norm(a){const l=v3len(a)||1e-9;return [a[0]/l,a[1]/l,a[2]/l];}
function edgeKey(a,b){return a<b ? (a+'_'+b) : (b+'_'+a);}

/* Normal de un polígono (n-gon) por el método de Newell: robusto para no-triángulos */
function polygonNormal(V, face){
  let nx=0,ny=0,nz=0;
  const k=face.length;
  for(let i=0;i<k;i++){
    const a=V[face[i]], b=V[face[(i+1)%k]];
    nx += (a[1]-b[1])*(a[2]+b[2]);
    ny += (a[2]-b[2])*(a[0]+b[0]);
    nz += (a[0]-b[0])*(a[1]+b[1]);
  }
  return v3norm([nx,ny,nz]);
}
function polygonCentroid(V, face){
  let c=[0,0,0];
  face.forEach(vi=>{c=v3add(c,V[vi]);});
  return v3scale(c, 1/face.length);
}
/* Inserta un polígono (cara de N vértices) asegurando que su normal apunte hacia "outward" (heurística) */
function pushPolyOriented(V,F,idxArr,outward){
  const n = polygonNormal(V, idxArr);
  if(v3dot(n,outward)<0){ F.push(idxArr.slice().reverse()); }
  else { F.push(idxArr.slice()); }
}
function pushTriOriented(V,F,a,b,c,outward){ pushPolyOriented(V,F,[a,b,c],outward); }
function pushQuadOriented(V,F,a,b,c,d,outward){ pushPolyOriented(V,F,[a,b,c,d],outward); }

/* -------------------------------------------------------------------------
   2. GENERADORES DE PRIMITIVAS -> {vertices:[[x,y,z]...], faces:[[i,j,k,...]...]}
      Se generan como QUADS/N-GONS (igual que Blender), no triángulos sueltos.
   ------------------------------------------------------------------------- */
const Primitives = {

  cube(sx=2,sy=2,sz=2){
    const hx=sx/2, hy=sy/2, hz=sz/2;
    const V=[
      [-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],
      [-hx,-hy, hz],[hx,-hy, hz],[hx,hy, hz],[-hx,hy, hz],
    ];
    const F=[];
    pushQuadOriented(V,F,0,1,2,3,[0,0,-1]);
    pushQuadOriented(V,F,4,5,6,7,[0,0,1]);
    pushQuadOriented(V,F,0,1,5,4,[0,-1,0]);
    pushQuadOriented(V,F,2,3,7,6,[0,1,0]);
    pushQuadOriented(V,F,3,0,4,7,[-1,0,0]);
    pushQuadOriented(V,F,1,2,6,5,[1,0,0]);
    return {vertices:V, faces:F};
  },

  cylinder(radius=1, height=2, segs=16){
    segs=Math.max(3,Math.min(64,segs|0));
    const V=[],F=[];
    const top=[], bot=[];
    for(let i=0;i<segs;i++){
      const a=i/segs*Math.PI*2;
      V.push([Math.cos(a)*radius,Math.sin(a)*radius,height/2]); top.push(V.length-1);
    }
    for(let i=0;i<segs;i++){
      const a=i/segs*Math.PI*2;
      V.push([Math.cos(a)*radius,Math.sin(a)*radius,-height/2]); bot.push(V.length-1);
    }
    for(let i=0;i<segs;i++){
      const j=(i+1)%segs;
      const mid=[(V[top[i]][0]+V[top[j]][0])/2,(V[top[i]][1]+V[top[j]][1])/2,0];
      pushQuadOriented(V,F,bot[i],bot[j],top[j],top[i], v3norm(mid));
    }
    // tapas como n-gonos únicos (como Blender)
    pushPolyOriented(V,F, top.slice(), [0,0,1]);
    pushPolyOriented(V,F, bot.slice(), [0,0,-1]);
    return {vertices:V, faces:F};
  },

  cone(radius=1, height=2, segs=16){
    segs=Math.max(3,Math.min(64,segs|0));
    const V=[],F=[];
    const bot=[];
    for(let i=0;i<segs;i++){
      const a=i/segs*Math.PI*2;
      V.push([Math.cos(a)*radius,Math.sin(a)*radius,-height/2]); bot.push(V.length-1);
    }
    const apex=V.push([0,0,height/2])-1;
    for(let i=0;i<segs;i++){
      const j=(i+1)%segs;
      const mid=[(V[bot[i]][0]+V[bot[j]][0])/2,(V[bot[i]][1]+V[bot[j]][1])/2,0];
      pushTriOriented(V,F,bot[i],bot[j],apex, v3norm(mid));
    }
    pushPolyOriented(V,F, bot.slice(), [0,0,-1]);
    return {vertices:V, faces:F};
  },

  sphere(radius=1, rings=12, segs=16){
    rings=Math.max(3,Math.min(48,rings|0)); segs=Math.max(3,Math.min(64,segs|0));
    const V=[],F=[];
    const grid=[];
    for(let r=0;r<=rings;r++){
      const phi=r/rings*Math.PI;
      const row=[];
      for(let s=0;s<segs;s++){
        const theta=s/segs*Math.PI*2;
        row.push(V.push([
          radius*Math.sin(phi)*Math.cos(theta),
          radius*Math.sin(phi)*Math.sin(theta),
          radius*Math.cos(phi)
        ])-1);
      }
      grid.push(row);
    }
    for(let r=0;r<rings;r++){
      for(let s=0;s<segs;s++){
        const s2=(s+1)%segs;
        const a=grid[r][s], b=grid[r][s2], c=grid[r+1][s2], d=grid[r+1][s];
        const outward=v3norm(V[a]);
        if(r===0){ pushTriOriented(V,F,a,c,d,outward); }
        else if(r===rings-1){ pushTriOriented(V,F,a,b,c,outward); }
        else { pushQuadOriented(V,F,a,b,c,d,outward); }
      }
    }
    return {vertices:V, faces:F};
  },

  torus(R=1, r=0.35, radialSeg=20, tubeSeg=12){
    radialSeg=Math.max(3,Math.min(48,radialSeg|0)); tubeSeg=Math.max(3,Math.min(32,tubeSeg|0));
    const V=[],F=[];
    const grid=[];
    for(let i=0;i<=radialSeg;i++){
      const u=i/radialSeg*Math.PI*2;
      const row=[];
      for(let j=0;j<tubeSeg;j++){
        const v=j/tubeSeg*Math.PI*2;
        row.push(V.push([
          (R+r*Math.cos(v))*Math.cos(u),
          (R+r*Math.cos(v))*Math.sin(u),
          r*Math.sin(v)
        ])-1);
      }
      grid.push(row);
    }
    for(let i=0;i<radialSeg;i++){
      for(let j=0;j<tubeSeg;j++){
        const j2=(j+1)%tubeSeg;
        const a=grid[i][j], b=grid[i+1][j], c=grid[i+1][j2], d=grid[i][j2];
        const cu=i/radialSeg*Math.PI*2;
        const outward=v3sub(V[a], [Math.cos(cu)*R, Math.sin(cu)*R, 0]);
        pushQuadOriented(V,F,a,b,c,d,outward);
      }
    }
    return {vertices:V, faces:F};
  },

  plane(w=2,d=2){
    const hx=w/2, hy=d/2;
    const V=[[-hx,-hy,0],[hx,-hy,0],[hx,hy,0],[-hx,hy,0]];
    const F=[];
    pushQuadOriented(V,F,0,1,2,3,[0,0,1]);
    return {vertices:V, faces:F};
  }
};

/* -------------------------------------------------------------------------
   3. MODIFICADORES (operan sobre {vertices,faces} de N-GONOS y devuelven una nueva malla)
   ------------------------------------------------------------------------- */
const Modifiers = {

  subsurf(mesh, params){
    let data = {vertices:mesh.vertices.map(p=>p.slice()), faces:mesh.faces.map(f=>f.slice())};
    const levels = Math.max(0,Math.min(3, params.levels|0));
    for(let L=0; L<levels; L++){
      if(data.faces.length > 20000) break; // límite de seguridad (el nº de caras se multiplica ~x4 cada nivel)
      data = catmullClarkOnce(data);
    }
    return data;
  },

  bevel(mesh, params){
    const amount = Math.max(0, Math.min(0.45, params.amount));
    if(amount<=0.0001) return mesh;
    return bevelMesh(mesh, amount);
  },

  array(mesh, params){
    const count = Math.max(1, Math.min(32, params.count|0));
    const off=[params.ox||0, params.oy||0, params.oz||0];
    const V=[],F=[];
    for(let i=0;i<count;i++){
      const base=V.length;
      mesh.vertices.forEach(p=>V.push([p[0]+off[0]*i,p[1]+off[1]*i,p[2]+off[2]*i]));
      mesh.faces.forEach(f=>F.push(f.map(vi=>vi+base)));
    }
    return {vertices:V, faces:F};
  },

  mirror(mesh, params){
    const axis = params.axis || 'x';
    const ai = axis==='x'?0:axis==='y'?1:2;
    const base = mesh.vertices.length;
    const V = mesh.vertices.map(p=>p.slice());
    mesh.vertices.forEach(p=>{const q=p.slice(); q[ai]=-q[ai]; V.push(q);});
    const F = mesh.faces.map(f=>f.slice());
    mesh.faces.forEach(f=> F.push(f.map(vi=>vi+base).reverse()) );
    return {vertices:V, faces:F};
  },

  solidify(mesh, params){
    const thickness = params.thickness || 0.1;
    const V=mesh.vertices, F=mesh.faces;
    const vnorm = V.map(()=>[0,0,0]);
    F.forEach(f=>{
      const n=polygonNormal(V,f);
      f.forEach(vi=>{ vnorm[vi]=v3add(vnorm[vi], n); });
    });
    vnorm.forEach(n=>{const l=v3len(n)||1; n[0]/=l;n[1]/=l;n[2]/=l;});
    const half=thickness/2;
    const outer=V.map((p,i)=>v3add(p, v3scale(vnorm[i], half)));
    const inner=V.map((p,i)=>v3add(p, v3scale(vnorm[i], -half)));
    const offset=outer.length;
    const allV=outer.concat(inner);
    const outerF=F.map(f=>f.slice());
    const innerF=F.map(f=> f.map(vi=>vi+offset).reverse());
    return {vertices:allV, faces:outerF.concat(innerF)};
  },

  wireframe(mesh, params){
    const radius = Math.max(0.005, params.radius || 0.03);
    const V=mesh.vertices, F=mesh.faces;
    const edgeSet=new Map();
    F.forEach(f=>{
      const k=f.length;
      for(let e=0;e<k;e++){ const a=f[e], b=f[(e+1)%k]; edgeSet.set(edgeKey(a,b), [a,b]); }
    });
    const newV=[], newF=[];
    const segs=6;
    edgeSet.forEach(([a,b])=>{
      const p0=V[a], p1=V[b];
      const dir=v3norm(v3sub(p1,p0));
      let up=[0,0,1]; if(Math.abs(dir[2])>0.9) up=[1,0,0];
      const rx=v3norm(v3cross(dir,up));
      const ry=v3norm(v3cross(dir,rx));
      const base=newV.length;
      for(let s=0;s<segs;s++){
        const ang=s/segs*Math.PI*2;
        const ox=Math.cos(ang)*radius, oy=Math.sin(ang)*radius;
        const off=[rx[0]*ox+ry[0]*oy, rx[1]*ox+ry[1]*oy, rx[2]*ox+ry[2]*oy];
        newV.push(v3add(p0,off));
        newV.push(v3add(p1,off));
      }
      for(let s=0;s<segs;s++){
        const s2=(s+1)%segs;
        const a0=base+s*2, a1=base+s*2+1, b0=base+s2*2, b1=base+s2*2+1;
        const ang=(s+0.5)/segs*Math.PI*2;
        const outward=[rx[0]*Math.cos(ang)+ry[0]*Math.sin(ang), rx[1]*Math.cos(ang)+ry[1]*Math.sin(ang), rx[2]*Math.cos(ang)+ry[2]*Math.sin(ang)];
        pushQuadOriented(newV,newF,a0,b0,b1,a1,outward);
      }
    });
    return {vertices:newV, faces:newF};
  },

  simpledeform(mesh, params){
    const angleDeg = params.angle||0;
    const axis = params.axis || 'z';
    const ai = axis==='x'?0:axis==='y'?1:2;
    const V=mesh.vertices;
    let min=Infinity,max=-Infinity;
    V.forEach(p=>{ if(p[ai]<min)min=p[ai]; if(p[ai]>max)max=p[ai]; });
    const range=(max-min)||1;
    const newV = V.map(p=>{
      const t=(p[ai]-min)/range - 0.5;
      const ang=t*angleDeg*Math.PI/180;
      const cos=Math.cos(ang), sin=Math.sin(ang);
      if(ai===2){ return [p[0]*cos-p[1]*sin, p[0]*sin+p[1]*cos, p[2]]; }
      if(ai===0){ return [p[0], p[1]*cos-p[2]*sin, p[1]*sin+p[2]*cos]; }
      return [p[0]*cos+p[2]*sin, p[1], -p[0]*sin+p[2]*cos];
    });
    return {vertices:newV, faces:mesh.faces.map(f=>f.slice())};
  },
};

/* --- Subdivisión de Catmull-Clark (una iteración, soporta n-gonos, produce quads) --- */
function catmullClarkOnce(mesh){
  const V=mesh.vertices, F=mesh.faces;
  const nV=V.length;
  const facePoints = F.map(f=>polygonCentroid(V,f));
  const edgeMap = new Map();
  F.forEach((f,fi)=>{
    const k=f.length;
    for(let i=0;i<k;i++){
      const a=f[i], b=f[(i+1)%k];
      const key=edgeKey(a,b);
      if(!edgeMap.has(key)) edgeMap.set(key,{v0:a,v1:b,faces:[]});
      edgeMap.get(key).faces.push(fi);
    }
  });
  const edgePoint = new Map();
  edgeMap.forEach((info,key)=>{
    const mid=v3scale(v3add(V[info.v0],V[info.v1]),0.5);
    if(info.faces.length===2){
      const favg=v3scale(v3add(facePoints[info.faces[0]],facePoints[info.faces[1]]),0.5);
      edgePoint.set(key, v3scale(v3add(mid,favg),0.5));
    } else {
      edgePoint.set(key, mid);
    }
  });
  const incidentFaces = Array.from({length:nV},()=>[]);
  const incidentEdgeMids = Array.from({length:nV},()=>[]);
  F.forEach((f,fi)=>{ f.forEach(vi=>incidentFaces[vi].push(fi)); });
  edgeMap.forEach(info=>{
    const mid=v3scale(v3add(V[info.v0],V[info.v1]),0.5);
    incidentEdgeMids[info.v0].push(mid);
    incidentEdgeMids[info.v1].push(mid);
  });
  const newVertexPos = V.map((p,i)=>{
    const n = incidentEdgeMids[i].length;
    if(n===0) return p.slice();
    if(incidentFaces[i].length < n){ return p.slice(); } // borde / no-manifold: se deja fijo (seguro)
    let favg=[0,0,0];
    incidentFaces[i].forEach(fi=>{favg=v3add(favg,facePoints[fi]);});
    favg=v3scale(favg,1/incidentFaces[i].length);
    let ravg=[0,0,0];
    incidentEdgeMids[i].forEach(m=>{ravg=v3add(ravg,m);});
    ravg=v3scale(ravg,1/n);
    const term=v3add(v3add(favg, v3scale(ravg,2)), v3scale(p, n-3));
    return v3scale(term, 1/n);
  });
  const newV = newVertexPos.map(p=>p.slice());
  const facePointIndex = facePoints.map(fp=>{ newV.push(fp.slice()); return newV.length-1; });
  const edgePointIndex = new Map();
  edgePoint.forEach((p,key)=>{ edgePointIndex.set(key,newV.length); newV.push(p.slice()); });
  const newF=[];
  F.forEach((f,fi)=>{
    const k=f.length;
    for(let i=0;i<k;i++){
      const vCur=f[i], vPrev=f[(i-1+k)%k], vNext=f[(i+1)%k];
      const epNext=edgePointIndex.get(edgeKey(vCur,vNext));
      const epPrev=edgePointIndex.get(edgeKey(vPrev,vCur));
      newF.push([vCur, epNext, facePointIndex[fi], epPrev]);
    }
  });
  return {vertices:newV, faces:newF};
}

/* --- Bevel: inset por cara (conserva su nº de lados) + costuras de arista (quads) + tapa de vértice (n-gono) --- */
function bevelMesh(mesh, t){
  const V=mesh.vertices, F=mesh.faces;
  const newV=[];
  const cornerIndex=[];
  F.forEach(face=>{
    const c = polygonCentroid(V, face);
    const idx = face.map(vi=>{
      const p=V[vi];
      newV.push([p[0]+(c[0]-p[0])*t, p[1]+(c[1]-p[1])*t, p[2]+(c[2]-p[2])*t]);
      return newV.length-1;
    });
    cornerIndex.push(idx);
  });
  const newF=[];
  F.forEach((face,fi)=>{
    const n=polygonNormal(V,face);
    pushPolyOriented(newV,newF,cornerIndex[fi],n);
  });
  const edgeMap=new Map();
  F.forEach((face,fi)=>{
    const n=polygonNormal(V,face);
    const k=face.length;
    for(let i=0;i<k;i++){
      const a=face[i], b=face[(i+1)%k];
      const ca=cornerIndex[fi][i], cb=cornerIndex[fi][(i+1)%k];
      const key=edgeKey(a,b);
      if(!edgeMap.has(key)) edgeMap.set(key,[]);
      edgeMap.get(key).push({a,b,ca,cb,n});
    }
  });
  edgeMap.forEach(list=>{
    if(list.length===2){
      const A=list[0], B=list[1];
      const outward=v3norm(v3add(A.n,B.n));
      pushQuadOriented(newV,newF,A.ca,A.cb,B.ca,B.cb,outward);
    }
  });
  const byVert=new Map();
  F.forEach((face,fi)=>{
    face.forEach((v,c)=>{
      if(!byVert.has(v)) byVert.set(v,[]);
      byVert.get(v).push(cornerIndex[fi][c]);
    });
  });
  byVert.forEach((corners,v)=>{
    if(corners.length<3) return;
    const base=V[v];
    let normal=[0,0,0];
    corners.forEach(ci=>{ normal=v3add(normal, v3sub(newV[ci],base)); });
    normal=v3norm(normal);
    if(v3len(normal)<1e-6) return;
    let u=v3sub(newV[corners[0]],base);
    u=v3sub(u, v3scale(normal, v3dot(u,normal)));
    if(v3len(u)<1e-9) return;
    u=v3norm(u);
    const w=v3cross(normal,u);
    const sorted=corners.slice().sort((ca,cb)=>{
      const da=v3sub(newV[ca],base), db=v3sub(newV[cb],base);
      return Math.atan2(v3dot(da,w),v3dot(da,u)) - Math.atan2(v3dot(db,w),v3dot(db,u));
    });
    pushPolyOriented(newV,newF,sorted,normal);
  });
  return {vertices:newV, faces:newF};
}

/* -------------------------------------------------------------------------
   4. CONVERSIÓN MeshData -> THREE.BufferGeometry
      (los polígonos se trianguladan en abanico SOLO para la GPU;
       la topología de edición sigue siendo de n-gonos)
   ------------------------------------------------------------------------- */
function meshDataToGeometry(data, smooth){
  const geo = new THREE.BufferGeometry();
  const triToFace = [];
  if(!data.faces.length){
    geo.setAttribute('position', new THREE.Float32BufferAttribute([],3));
    geo.userData.triToFace = triToFace;
    return geo;
  }
  if(smooth){
    const positions=new Float32Array(data.vertices.length*3);
    data.vertices.forEach((p,i)=>{positions[i*3]=p[0];positions[i*3+1]=p[1];positions[i*3+2]=p[2];});
    const index=[];
    data.faces.forEach((f,fi)=>{
      for(let k=1;k<f.length-1;k++){ index.push(f[0],f[k],f[k+1]); triToFace.push(fi); }
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geo.setIndex(index);
    geo.computeVertexNormals();
  } else {
    let triCount=0;
    data.faces.forEach(f=>{ triCount += Math.max(0,f.length-2); });
    const positions=new Float32Array(triCount*3*3);
    const normals=new Float32Array(triCount*3*3);
    let p=0, ni=0;
    data.faces.forEach((f,fi)=>{
      const n = polygonNormal(data.vertices, f);
      for(let k=1;k<f.length-1;k++){
        [f[0],f[k],f[k+1]].forEach(vi=>{
          const v=data.vertices[vi];
          positions[p]=v[0]; positions[p+1]=v[1]; positions[p+2]=v[2]; p+=3;
          normals[ni]=n[0]; normals[ni+1]=n[1]; normals[ni+2]=n[2]; ni+=3;
        });
        triToFace.push(fi);
      }
    });
    geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals,3));
  }
  geo.userData.triToFace = triToFace;
  return geo;
}

function buildEdgeList(data){
  const seen=new Map(); const list=[];
  data.faces.forEach(f=>{
    const k=f.length;
    for(let e=0;e<k;e++){
      const a=f[e], b=f[(e+1)%k];
      const key=edgeKey(a,b);
      if(!seen.has(key)){ seen.set(key,list.length); list.push([a,b]); }
    }
  });
  return list;
}

/* -------------------------------------------------------------------------
   LOOP CUT (Ctrl+R): sólo funciona sobre caras cuadrangulares (como en Blender).
   Camina el "anillo" de quads cruzando siempre por la arista opuesta, en las
   dos direcciones desde la cara bajo el ratón, e inserta un vértice medio
   compartido en cada arista cruzada para partir cada quad en dos.
   ------------------------------------------------------------------------- */
function buildEdgeFaceMap(data){
  const map=new Map(); // edgeKey -> [{faceIndex, edgeLocal}]
  data.faces.forEach((f,fi)=>{
    const k=f.length;
    for(let i=0;i<k;i++){
      const a=f[i], b=f[(i+1)%k];
      const key=edgeKey(a,b);
      if(!map.has(key)) map.set(key,[]);
      map.get(key).push({faceIndex:fi, edgeLocal:i});
    }
  });
  return map;
}
function computeLoopRing(data, faceIndex, edgeLocal){
  const face0 = data.faces[faceIndex];
  if(!face0 || face0.length!==4) return [];
  const edgeFaceMap = buildEdgeFaceMap(data);
  const visited = new Set();
  function stepChain(startFace, startEdgeLocal, out){
    let curFace=startFace, curEdge=startEdgeLocal;
    while(curFace!=null && !visited.has(curFace)){
      const face=data.faces[curFace];
      if(!face || face.length!==4) break;
      visited.add(curFace);
      const outEdge=(curEdge+2)%4;
      out.push({faceIndex:curFace, edgeA:curEdge, edgeB:outEdge});
      const a=face[outEdge], b=face[(outEdge+1)%4];
      const cands=edgeFaceMap.get(edgeKey(a,b))||[];
      const nb=cands.find(c=>c.faceIndex!==curFace);
      if(!nb){ curFace=null; break; }
      curFace=nb.faceIndex; curEdge=nb.edgeLocal;
    }
  }
  const fwd=[];
  stepChain(faceIndex, edgeLocal, fwd);
  const a0=face0[edgeLocal], b0=face0[(edgeLocal+1)%4];
  const cand0=(edgeFaceMap.get(edgeKey(a0,b0))||[]).find(c=>c.faceIndex!==faceIndex);
  const bwd=[];
  if(cand0) stepChain(cand0.faceIndex, cand0.edgeLocal, bwd);
  return bwd.slice().reverse().concat(fwd);
}
function getOrCreateMid(data, midCache, a, b){
  const key=edgeKey(a,b);
  if(midCache.has(key)) return midCache.get(key);
  const pa=data.vertices[a], pb=data.vertices[b];
  const idx=data.vertices.length;
  data.vertices.push([(pa[0]+pb[0])/2,(pa[1]+pb[1])/2,(pa[2]+pb[2])/2]);
  midCache.set(key, idx);
  return idx;
}
function splitQuad(face, edgeALocal, midA, midB){
  const edgeBLocal=(edgeALocal+2)%4;
  const face1=[midA, face[(edgeALocal+1)%4], face[edgeBLocal], midB];
  const face2=[midB, face[(edgeBLocal+1)%4], face[edgeALocal], midA];
  return [face1, face2];
}

/* -------------------------------------------------------------------------
   5. ESCENA THREE.JS
   ------------------------------------------------------------------------- */
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3c3c3c);

const persp = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
const ortho = new THREE.OrthographicCamera(-5,5,5,-5,0.01,5000);
let activeCamKind = 'persp';
function activeCamera(){ return activeCamKind==='persp' ? persp : ortho; }

scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(4,-6,8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-5,4,-3);
scene.add(fillLight);

const grid = new THREE.GridHelper(40, 40, 0x606060, 0x4a4a4a);
grid.rotation.x = Math.PI/2;
scene.add(grid);
function makeAxisLine(dir,color){
  const g=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-dir[0]*20,-dir[1]*20,-dir[2]*20),
    new THREE.Vector3(dir[0]*20,dir[1]*20,dir[2]*20)
  ]);
  return new THREE.Line(g, new THREE.LineBasicMaterial({color}));
}
scene.add(makeAxisLine([1,0,0],0xaa5555));
scene.add(makeAxisLine([0,1,0],0x559955));

/* ---- Cámara orbital tipo Blender (esférica, Z arriba) ---- */
const orbit = { theta:-Math.PI/4, phi:Math.PI/3, radius:9, target:new THREE.Vector3(0,0,0) };
function updateCameraFromOrbit(){
  const st=Math.sin(orbit.phi), ct=Math.cos(orbit.phi);
  const x = orbit.target.x + orbit.radius*st*Math.cos(orbit.theta);
  const y = orbit.target.y + orbit.radius*st*Math.sin(orbit.theta);
  const z = orbit.target.z + orbit.radius*ct;
  [persp,ortho].forEach(cam=>{
    cam.up.set(0,0,1);
    cam.position.set(x,y,z);
    cam.lookAt(orbit.target);
  });
  const aspect = canvas.clientWidth/Math.max(1,canvas.clientHeight);
  const halfH = orbit.radius*0.62;
  ortho.left=-halfH*aspect; ortho.right=halfH*aspect; ortho.top=halfH; ortho.bottom=-halfH;
  ortho.updateProjectionMatrix();
}
updateCameraFromOrbit();

function resize(){
  const w=canvas.clientWidth, h=canvas.clientHeight;
  renderer.setSize(w,h,false);
  persp.aspect = w/Math.max(1,h);
  persp.updateProjectionMatrix();
  updateCameraFromOrbit();
}
window.addEventListener('resize', resize);

/* -------------------------------------------------------------------------
   6. OBJETOS DE ESCENA
   ------------------------------------------------------------------------- */
let objects = [];
let selectedObject = null;
/* Ganchos opcionales para multiplayer.js (permanecen null/true y no hacen nada si no hay sala activa) */
let onSceneChanged = null;        // se llama tras cualquier cambio de geometría/transform
let onModalOrEditModeEnded = null; // se llama al soltar un G/R/S/E/I o salir de Edit Mode
let canEdit = true;                // false = modo espectador (partida en marcha y no es tu turno)
let objCounter = {cube:0,sphere:0,cylinder:0,cone:0,torus:0,plane:0};
const PALETTE = [0xe0724a,0x5aa9d6,0x8fc75a,0xe0c34a,0xb17adf,0xd65a8f,0x5ad6c0,0xd6a95a];
let paletteIdx=0;
function randColor(){ const c=PALETTE[paletteIdx%PALETTE.length]; paletteIdx++; return c; }

class SceneObject{
  constructor(kind, meshData, name){
    this.kind = kind;
    this.baseMesh = meshData;
    this.derivedMesh = meshData;
    this.modifiers = [];
    this.name = name;
    this.smooth = false;
    this.color = randColor();
    this.position = new THREE.Vector3(0,0,0);
    this.rotation = new THREE.Euler(0,0,0);
    this.scale = new THREE.Vector3(1,1,1);

    this.material = new THREE.MeshStandardMaterial({
      color:this.color, flatShading:!this.smooth, roughness:0.65, metalness:0.05, side:THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(meshDataToGeometry(meshData,this.smooth), this.material);
    this.mesh.userData.owner = this;
    scene.add(this.mesh);

    this.outlineMat = new THREE.MeshBasicMaterial({color:0xff9d3d, side:THREE.BackSide, depthWrite:true});
    this.outline = new THREE.Mesh(this.mesh.geometry, this.outlineMat);
    this.outline.visible=false;
    scene.add(this.outline);

    this.syncTransform();
    this.rebuild();
  }
  syncTransform(){
    this.mesh.position.copy(this.position);
    this.mesh.rotation.copy(this.rotation);
    this.mesh.scale.copy(this.scale);
    this.outline.position.copy(this.position);
    this.outline.rotation.copy(this.rotation);
    this.outline.scale.copy(this.scale).multiplyScalar(1.035);
    if(onSceneChanged) onSceneChanged();
  }
  rebuild(){
    let data = {vertices:this.baseMesh.vertices.map(p=>p.slice()), faces:this.baseMesh.faces.map(f=>f.slice())};
    if(!(editMode && selectedObject===this)){
      for(const mod of this.modifiers){
        try{
          const fn = Modifiers[mod.type];
          if(fn) data = fn(data, mod.params);
        }catch(e){ console.warn('Modificador falló:',mod.type,e); }
        if(data.faces.length>60000) break;
      }
    }
    this.derivedMesh = data;
    const geo = meshDataToGeometry(data, this.smooth);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.outline.geometry = geo;
    this.material.flatShading = !this.smooth;
    this.material.needsUpdate = true;
    this.material.color.set(this.color);
    if(onSceneChanged) onSceneChanged();
  }
  dispose(){
    scene.remove(this.mesh); scene.remove(this.outline);
    this.mesh.geometry.dispose(); this.material.dispose(); this.outlineMat.dispose();
  }
}

function addObject(kind, {record=true, force=false}={}){
  if(!canEdit && !force) return null;
  let data;
  switch(kind){
    case 'cube': data=Primitives.cube(2,2,2); break;
    case 'sphere': data=Primitives.sphere(1,12,16); break;
    case 'cylinder': data=Primitives.cylinder(1,2,20); break;
    case 'cone': data=Primitives.cone(1,2,20); break;
    case 'torus': data=Primitives.torus(1,0.35,24,12); break;
    case 'plane': data=Primitives.plane(2,2); break;
    default: return;
  }
  if(record) pushUndo();
  objCounter[kind]++;
  const name = kind.charAt(0).toUpperCase()+kind.slice(1) + (objCounter[kind]>1? '.'+String(objCounter[kind]-1).padStart(3,'0'):'');
  const obj = new SceneObject(kind, data, name);
  objects.push(obj);
  selectObject(obj);
  refreshOutliner();
  setStatus('Añadido: '+name);
  return obj;
}

function deleteObject(obj){
  if(!obj || !canEdit) return;
  pushUndo();
  objects = objects.filter(o=>o!==obj);
  obj.dispose();
  if(selectedObject===obj) selectObject(objects[0]||null);
  refreshOutliner();
  if(onSceneChanged) onSceneChanged();
}

/* Usado por game.js: borra todo y deja un cubo limpio para que el modelador empiece la ronda */
function resetSceneForNewRound(){
  objects.forEach(o=>o.dispose());
  objects=[];
  selectObject(null);
  undoStack=[]; redoStack=[];
  if(typeof updateUndoButtons==='function') updateUndoButtons();
  addObject('cube', {record:false, force:true});
}

function selectObject(obj){
  selectedObject = obj;
  objects.forEach(o=>o.outline.visible=(o===obj));
  refreshOutliner();
  refreshNPanel();
  refreshPropObject();
  refreshPropMaterial();
  refreshPropModifiers();
}

/* -------------------------------------------------------------------------
   7. NAVEGACIÓN DE VIEWPORT (MMB orbit, Shift+MMB pan, Ctrl+MMB/scroll zoom)
   ------------------------------------------------------------------------- */
let nav = {dragging:false, mode:null, lastX:0, lastY:0};
canvas.addEventListener('contextmenu', e=>e.preventDefault());

function setView(theta,phi){ orbit.theta=theta; orbit.phi=phi; updateCameraFromOrbit(); }

canvas.addEventListener('wheel',(e)=>{
  e.preventDefault();
  orbit.radius *= (e.deltaY>0?1.1:0.9);
  orbit.radius = Math.max(0.5, Math.min(400, orbit.radius));
  updateCameraFromOrbit();
},{passive:false});

/* -------------------------------------------------------------------------
   8. RAYCAST / SELECCIÓN
   ------------------------------------------------------------------------- */
const raycaster = new THREE.Raycaster();
function ndcFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX-rect.left)/rect.width)*2-1,
    -((e.clientY-rect.top)/rect.height)*2+1
  );
}
function worldToScreen(vec3){
  const p=vec3.clone().project(activeCamera());
  const rect=canvas.getBoundingClientRect();
  return {x:rect.left+(p.x*0.5+0.5)*rect.width, y:rect.top+(-p.y*0.5+0.5)*rect.height};
}

/* Oclusión: comprueba si un punto del objeto seleccionado está tapado por su propia malla */
function isWorldPointOccluded(worldPos, cam){
  const toP = worldPos.clone().sub(cam.position);
  const dist = toP.length();
  if(dist<1e-6) return false;
  const dir = toP.clone().normalize();
  const savedNear=raycaster.near, savedFar=raycaster.far;
  raycaster.set(cam.position, dir);
  raycaster.near = 0.001;
  raycaster.far = dist - Math.max(0.01, dist*0.002);
  const hits = raycaster.intersectObject(selectedObject.mesh);
  raycaster.near = savedNear; raycaster.far = savedFar;
  return hits.length>0;
}

function pickVertex(mx,my,cam){
  let best=-1, bestD=12;
  selectedObject.baseMesh.vertices.forEach((p,i)=>{
    const world=new THREE.Vector3(p[0],p[1],p[2]).applyMatrix4(selectedObject.mesh.matrixWorld);
    const s=worldToScreen(world);
    const d=Math.hypot(s.x-mx, s.y-my);
    if(d<bestD && !isWorldPointOccluded(world,cam)){ bestD=d; best=i; }
  });
  return best;
}
function pointSegDist(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay;
  const len2=dx*dx+dy*dy;
  let t = len2>0 ? ((px-ax)*dx+(py-ay)*dy)/len2 : 0;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
function pickEdge(mx,my,cam){
  const edgeList = buildEdgeList(selectedObject.baseMesh);
  let best=-1, bestD=9;
  edgeList.forEach(([a,b],i)=>{
    const pa=selectedObject.baseMesh.vertices[a], pb=selectedObject.baseMesh.vertices[b];
    const wa=new THREE.Vector3(pa[0],pa[1],pa[2]).applyMatrix4(selectedObject.mesh.matrixWorld);
    const wb=new THREE.Vector3(pb[0],pb[1],pb[2]).applyMatrix4(selectedObject.mesh.matrixWorld);
    const sa=worldToScreen(wa), sb=worldToScreen(wb);
    const d=pointSegDist(mx,my,sa.x,sa.y,sb.x,sb.y);
    if(d<bestD){
      const mid=wa.clone().add(wb).multiplyScalar(0.5);
      if(!isWorldPointOccluded(mid,cam)){ bestD=d; best=i; }
    }
  });
  return {index:best, list:edgeList};
}

function handleViewportClick(e){
  if(!editMode){
    const ndc = ndcFromEvent(e);
    raycaster.setFromCamera(ndc, activeCamera());
    const hits = raycaster.intersectObjects(objects.map(o=>o.mesh));
    if(hits.length){ selectObject(hits[0].object.userData.owner); }
    else { selectObject(null); }
    return;
  }
  if(!selectedObject) return;
  const cam=activeCamera();
  const mx=e.clientX, my=e.clientY;

  if(editSelectMode==='face'){
    const ndc = ndcFromEvent(e);
    raycaster.setFromCamera(ndc, cam);
    const hits = raycaster.intersectObject(selectedObject.mesh);
    if(hits.length){
      const triToFace = selectedObject.mesh.geometry.userData.triToFace;
      const fi = triToFace ? triToFace[hits[0].faceIndex] : hits[0].faceIndex;
      if(!e.shiftKey) editSelection.faces.clear();
      if(editSelection.faces.has(fi)) editSelection.faces.delete(fi); else editSelection.faces.add(fi);
    } else if(!e.shiftKey){ editSelection.faces.clear(); }
  } else if(editSelectMode==='edge'){
    const {index} = pickEdge(mx,my,cam);
    if(!e.shiftKey) editSelection.edges.clear();
    if(index>=0){ if(editSelection.edges.has(index)) editSelection.edges.delete(index); else editSelection.edges.add(index); }
    else if(!e.shiftKey){ editSelection.edges.clear(); }
  } else {
    const best = pickVertex(mx,my,cam);
    if(!e.shiftKey) editSelection.verts.clear();
    if(best>=0){ if(editSelection.verts.has(best)) editSelection.verts.delete(best); else editSelection.verts.add(best); }
    else if(!e.shiftKey){ editSelection.verts.clear(); }
  }
  syncEditFromData();
}

/* -------------------------------------------------------------------------
   LOOP CUT interactivo (Ctrl+R): vista previa en vivo sobre la arista más
   cercana al ratón, clic izquierdo para cortar en el centro, clic
   derecho/Esc para cancelar. Sólo funciona sobre caras cuadrangulares.
   ------------------------------------------------------------------------- */
let loopCutMode=false;
let loopCutPreviewLine=null;
let loopCutRingSteps=null;

function enterLoopCutMode(){
  if(!editMode || !selectedObject || !canEdit) return;
  loopCutMode=true;
  setStatus('Loop Cut: mueve el ratón sobre una arista — clic para cortar, clic-der./Esc para cancelar');
}
function exitLoopCutMode(){
  loopCutMode=false;
  clearLoopCutPreview();
  loopCutRingSteps=null;
  setStatus('');
  if(onModalOrEditModeEnded) onModalOrEditModeEnded();
}
function clearLoopCutPreview(){
  if(loopCutPreviewLine){
    scene.remove(loopCutPreviewLine);
    loopCutPreviewLine.geometry.dispose();
    loopCutPreviewLine.material.dispose();
    loopCutPreviewLine=null;
  }
}
function updateLoopCutPreview(e){
  if(!loopCutMode || !selectedObject) return;
  const ndc=ndcFromEvent(e);
  raycaster.setFromCamera(ndc, activeCamera());
  const hits=raycaster.intersectObject(selectedObject.mesh);
  if(!hits.length){ clearLoopCutPreview(); loopCutRingSteps=null; return; }
  const triToFace=selectedObject.mesh.geometry.userData.triToFace;
  const fi = triToFace ? triToFace[hits[0].faceIndex] : hits[0].faceIndex;
  const data=selectedObject.baseMesh;
  const face=data.faces[fi];
  if(!face || face.length!==4){ clearLoopCutPreview(); loopCutRingSteps=null; return; } // sólo quads
  const mx=e.clientX, my=e.clientY;
  let bestLocal=0, bestD=Infinity;
  for(let i=0;i<4;i++){
    const a=face[i], b=face[(i+1)%4];
    const pa=data.vertices[a], pb=data.vertices[b];
    const wa=new THREE.Vector3(pa[0],pa[1],pa[2]).applyMatrix4(selectedObject.mesh.matrixWorld);
    const wb=new THREE.Vector3(pb[0],pb[1],pb[2]).applyMatrix4(selectedObject.mesh.matrixWorld);
    const sa=worldToScreen(wa), sb=worldToScreen(wb);
    const d=pointSegDist(mx,my,sa.x,sa.y,sb.x,sb.y);
    if(d<bestD){ bestD=d; bestLocal=i; }
  }
  loopCutRingSteps = computeLoopRing(data, fi, bestLocal);
  drawLoopCutPreview(data, loopCutRingSteps);
}
function edgePairKeyOfStep(data, step, which){
  const face=data.faces[step.faceIndex];
  const li = which==='A' ? step.edgeA : step.edgeB;
  return edgeKey(face[li], face[(li+1)%4]);
}
function drawLoopCutPreview(data, ringSteps){
  clearLoopCutPreview();
  if(!ringSteps || ringSteps.length===0) return;
  const pts=[];
  ringSteps.forEach(step=>{
    const face=data.faces[step.faceIndex];
    const a=face[step.edgeA], b=face[(step.edgeA+1)%4];
    const mid=v3scale(v3add(data.vertices[a],data.vertices[b]),0.5);
    pts.push(new THREE.Vector3(mid[0],mid[1],mid[2]));
  });
  const last=ringSteps[ringSteps.length-1];
  const faceL=data.faces[last.faceIndex];
  const aL=faceL[last.edgeB], bL=faceL[(last.edgeB+1)%4];
  const midB=v3scale(v3add(data.vertices[aL],data.vertices[bL]),0.5);
  pts.push(new THREE.Vector3(midB[0],midB[1],midB[2]));
  if(edgePairKeyOfStep(data,ringSteps[0],'A')===edgePairKeyOfStep(data,ringSteps[ringSteps.length-1],'B')){
    pts.push(pts[0].clone()); // el anillo se cierra sobre sí mismo: cerramos también la línea
  }
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineBasicMaterial({color:0xffe066, depthTest:false, transparent:true, opacity:0.95});
  loopCutPreviewLine=new THREE.Line(geo,mat);
  loopCutPreviewLine.position.copy(selectedObject.position);
  loopCutPreviewLine.rotation.copy(selectedObject.rotation);
  loopCutPreviewLine.scale.copy(selectedObject.scale);
  loopCutPreviewLine.renderOrder=9996;
  scene.add(loopCutPreviewLine);
}
function commitLoopCutFromPreview(){
  if(!loopCutRingSteps || loopCutRingSteps.length===0){ exitLoopCutMode(); return; }
  pushUndo();
  const data=selectedObject.baseMesh;
  const midCache=new Map();
  const orderedNewVerts=[];
  const splits=[];
  loopCutRingSteps.forEach((step,i)=>{
    const face=data.faces[step.faceIndex];
    const aA=face[step.edgeA], bA=face[(step.edgeA+1)%4];
    const aB=face[step.edgeB], bB=face[(step.edgeB+1)%4];
    const midA=getOrCreateMid(data, midCache, aA,bA);
    const midB=getOrCreateMid(data, midCache, aB,bB);
    splits.push({faceIndex:step.faceIndex, edgeALocal:step.edgeA, midA, midB});
    orderedNewVerts.push(midA);
    if(i===loopCutRingSteps.length-1) orderedNewVerts.push(midB);
  });
  const facesToRemove=new Set(splits.map(s=>s.faceIndex));
  const newFacesAll=[];
  splits.forEach(s=>{
    const face=data.faces[s.faceIndex]; // todavía válido: aún no hemos tocado data.faces
    const [f1,f2]=splitQuad(face, s.edgeALocal, s.midA, s.midB);
    newFacesAll.push(f1,f2);
  });
  data.faces = data.faces.filter((f,fi)=>!facesToRemove.has(fi)).concat(newFacesAll);

  editSelection.verts = new Set(orderedNewVerts);
  editSelection.edges.clear(); editSelection.faces.clear();
  if(editSelectMode==='edge'){
    const newEdgeList = buildEdgeList(data);
    const wantedKeys=new Set();
    for(let i=0;i<orderedNewVerts.length-1;i++) wantedKeys.add(edgeKey(orderedNewVerts[i],orderedNewVerts[i+1]));
    newEdgeList.forEach(([a,b],idx)=>{ if(wantedKeys.has(edgeKey(a,b))) editSelection.edges.add(idx); });
    editSelection.verts.clear();
  }
  loopCutMode=false;          // primero terminamos y emitimos NUESTRO cambio...
  clearLoopCutPreview();
  loopCutRingSteps=null;
  syncEditFromData();
  setStatus('Bucle insertado ('+orderedNewVerts.length+' vértices nuevos)');
  if(onModalOrEditModeEnded) onModalOrEditModeEnded(); // ...y sólo entonces aplicamos algo en cola
}

/* -------------------------------------------------------------------------
   9. MODO EDICIÓN (vértices / aristas / caras) — con deformación EN VIVO
   ------------------------------------------------------------------------- */
let editMode=false;
let editSelectMode='vertex'; // 'vertex' | 'edge' | 'face'
let editSelection={verts:new Set(), edges:new Set(), faces:new Set()};
let editHelperPoints=null, editHelperLines=null, faceHighlightMesh=null;

function enterEditMode(){
  if(!selectedObject) { document.getElementById('mode-select').value='object'; return; }
  editMode=true;
  editSelection.verts.clear(); editSelection.edges.clear(); editSelection.faces.clear();
  document.getElementById('edit-submode').classList.add('visible');
  selectedObject.rebuild();
  buildEditHelpers();
  syncEditFromData();
  setStatus('Modo Edición: '+selectedObject.name);
}
function exitEditMode(){
  editMode=false;
  if(loopCutMode) exitLoopCutMode();
  document.getElementById('edit-submode').classList.remove('visible');
  clearEditHelpers();
  if(selectedObject) selectedObject.rebuild();
  setStatus('Modo Objeto');
  if(onModalOrEditModeEnded) onModalOrEditModeEnded();
}
function buildEditHelpers(){
  clearEditHelpers();
  if(!selectedObject) return;
  const pGeo=new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(selectedObject.baseMesh.vertices.length*3),3));
  const pMat=new THREE.PointsMaterial({size:7, sizeAttenuation:false, vertexColors:true, depthTest:true});
  editHelperPoints = new THREE.Points(pGeo,pMat);
  editHelperPoints.renderOrder=999;
  scene.add(editHelperPoints);

  const lGeo=new THREE.BufferGeometry();
  const lMat=new THREE.LineBasicMaterial({vertexColors:true, depthTest:true});
  editHelperLines = new THREE.LineSegments(lGeo,lMat);
  editHelperLines.renderOrder=998;
  scene.add(editHelperLines);
}
function syncEditHelperTransform(){
  if(!selectedObject) return;
  [editHelperPoints, editHelperLines, faceHighlightMesh].forEach(o=>{
    if(!o) return;
    o.position.copy(selectedObject.position);
    o.rotation.copy(selectedObject.rotation);
    o.scale.copy(selectedObject.scale);
  });
}
function colorEditPoints(){
  if(!editHelperPoints) return;
  const n = selectedObject.baseMesh.vertices.length;
  const colors = new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const sel = editSelectMode==='vertex' && editSelection.verts.has(i);
    const c = sel? [1,0.55,0.16] : [0.02,0.02,0.02];
    colors[i*3]=c[0]; colors[i*3+1]=c[1]; colors[i*3+2]=c[2];
  }
  editHelperPoints.geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
}
function updateFaceHighlight(){
  if(faceHighlightMesh){ scene.remove(faceHighlightMesh); faceHighlightMesh.geometry.dispose(); faceHighlightMesh.material.dispose(); faceHighlightMesh=null; }
  if(!editMode || !selectedObject || editSelectMode!=='face' || editSelection.faces.size===0) return;
  const data=selectedObject.baseMesh;
  const positions=[];
  editSelection.faces.forEach(fi=>{
    const f=data.faces[fi];
    if(!f) return;
    for(let k=1;k<f.length-1;k++){
      [f[0],f[k],f[k+1]].forEach(vi=>{ const p=data.vertices[vi]; positions.push(p[0],p[1],p[2]); });
    }
  });
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  const mat=new THREE.MeshBasicMaterial({color:0xff8a2a, transparent:true, opacity:0.5, side:THREE.DoubleSide, depthTest:true});
  faceHighlightMesh=new THREE.Mesh(geo,mat);
  faceHighlightMesh.renderOrder=997;
  scene.add(faceHighlightMesh);
  syncEditHelperTransform();
}
/* Reconstruye TODO (malla sólida en vivo + puntos + aristas + resaltado) desde selectedObject.baseMesh */
function syncEditFromData(){
  if(!editMode || !selectedObject) return;
  selectedObject.rebuild(); // <- deformación en tiempo real de la malla sólida
  const data = selectedObject.baseMesh;

  const posArr=new Float32Array(data.vertices.length*3);
  data.vertices.forEach((p,i)=>{posArr[i*3]=p[0];posArr[i*3+1]=p[1];posArr[i*3+2]=p[2];});
  editHelperPoints.geometry.setAttribute('position', new THREE.BufferAttribute(posArr,3));
  colorEditPoints();

  const edgeList = buildEdgeList(data);
  const linePos=new Float32Array(edgeList.length*6);
  const lineCol=new Float32Array(edgeList.length*6);
  edgeList.forEach(([a,b],i)=>{
    const pa=data.vertices[a], pb=data.vertices[b];
    linePos[i*6]=pa[0];linePos[i*6+1]=pa[1];linePos[i*6+2]=pa[2];
    linePos[i*6+3]=pb[0];linePos[i*6+4]=pb[1];linePos[i*6+5]=pb[2];
    const sel = editSelectMode==='edge' && editSelection.edges.has(i);
    const c = sel? [1,0.55,0.16] : [0.05,0.05,0.05];
    lineCol[i*6]=c[0];lineCol[i*6+1]=c[1];lineCol[i*6+2]=c[2];
    lineCol[i*6+3]=c[0];lineCol[i*6+4]=c[1];lineCol[i*6+5]=c[2];
  });
  editHelperLines.geometry.dispose();
  editHelperLines.geometry=new THREE.BufferGeometry();
  editHelperLines.geometry.setAttribute('position', new THREE.BufferAttribute(linePos,3));
  editHelperLines.geometry.setAttribute('color', new THREE.BufferAttribute(lineCol,3));

  updateFaceHighlight();
  syncEditHelperTransform();
  updateSelectionStatus();
}
function clearEditHelpers(){
  if(editHelperPoints){ scene.remove(editHelperPoints); editHelperPoints.geometry.dispose(); editHelperPoints.material.dispose(); editHelperPoints=null; }
  if(editHelperLines){ scene.remove(editHelperLines); editHelperLines.geometry.dispose(); editHelperLines.material.dispose(); editHelperLines=null; }
  if(faceHighlightMesh){ scene.remove(faceHighlightMesh); faceHighlightMesh.geometry.dispose(); faceHighlightMesh.material.dispose(); faceHighlightMesh=null; }
}
function updateSelectionStatus(){
  if(!editMode) return;
  let n=0,label='vértice';
  if(editSelectMode==='vertex'){ n=editSelection.verts.size; label='vértice'; }
  else if(editSelectMode==='edge'){ n=editSelection.edges.size; label='arista'; }
  else { n=editSelection.faces.size; label='cara'; }
  setStatus(n+' '+label+(n!==1?'s':'')+' seleccionada'+(n!==1?'s':''));
}
function setEditSubmode(mode){
  editSelectMode=mode;
  document.querySelectorAll('.sub-btn').forEach(b=>b.classList.toggle('active', b.dataset.submode===mode));
  syncEditFromData();
}
function selectedVertexIndicesForTransform(){
  if(editSelectMode==='vertex') return [...editSelection.verts];
  if(editSelectMode==='edge'){
    const edgeList = buildEdgeList(selectedObject.baseMesh);
    const set=new Set();
    editSelection.edges.forEach(i=>{ const e=edgeList[i]; if(e){ set.add(e[0]); set.add(e[1]); } });
    return [...set];
  }
  const set=new Set();
  editSelection.faces.forEach(fi=>{ const f=selectedObject.baseMesh.faces[fi]; if(f) f.forEach(vi=>set.add(vi)); });
  return [...set];
}

/* -------------------------------------------------------------------------
   10. GIZMO 3D (mover / rotar / escalar) — estilo Blender, orientación global
   ------------------------------------------------------------------------- */
let currentTool='select';
function buildAxisMeshes(kind){
  const group = new THREE.Group();
  const colors = {x:0xe0524d, y:0x8fd34c, z:0x4f9fe8};
  ['x','y','z'].forEach(axis=>{
    const color=colors[axis];
    const mat=new THREE.MeshBasicMaterial({color, depthTest:false, transparent:true, opacity:0.95});
    let obj;
    if(kind==='move' || kind==='scale'){
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.75,8), mat);
      shaft.position.y=0.375;
      const tip = kind==='move'
        ? new THREE.Mesh(new THREE.ConeGeometry(0.085,0.22,10), mat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.15,0.15,0.15), mat);
      tip.position.y=0.85;
      obj=new THREE.Group(); obj.add(shaft); obj.add(tip);
      if(axis==='x') obj.rotation.z=-Math.PI/2;
      else if(axis==='z') obj.rotation.x=Math.PI/2;
    } else {
      obj = new THREE.Mesh(new THREE.TorusGeometry(0.9,0.02,8,40), mat);
      if(axis==='x') obj.rotation.y=Math.PI/2;
      else if(axis==='y') obj.rotation.x=Math.PI/2;
    }
    obj.traverse(o=>{ if(o.isMesh){ o.userData.axis=axis; o.renderOrder=9999; }});
    group.add(obj);
  });
  group.visible=false;
  group.renderOrder=9999;
  scene.add(group);
  return group;
}
const gizmoGroups = { move: buildAxisMeshes('move'), rotate: buildAxisMeshes('rotate'), scale: buildAxisMeshes('scale') };

function updateGizmoVisibility(){
  ['move','rotate','scale'].forEach(k=>{
    const g=gizmoGroups[k];
    const show = !editMode && !!selectedObject && currentTool===k;
    g.visible = show;
    if(show){
      g.position.copy(selectedObject.position);
      g.scale.setScalar(orbit.radius*0.13);
    }
  });
}
function tryGizmoDrag(e){
  if(editMode || !selectedObject || currentTool==='select') return false;
  const g = gizmoGroups[currentTool];
  if(!g.visible) return false;
  const ndc=ndcFromEvent(e);
  raycaster.setFromCamera(ndc, activeCamera());
  const meshes=[]; g.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  const hits=raycaster.intersectObjects(meshes,false);
  if(hits.length){
    startModal(currentTool, e);
    if(!modal.active) return false;
    modal.axis = hits[0].object.userData.axis;
    modal.dragStyle='press';
    modal.value = (currentTool==='scale')?1:0;
    updateModalHint('');
    updateConstraintLine();
    return true;
  }
  return false;
}

/* -------------------------------------------------------------------------
   11. OPERADOR MODAL: GRAB (G) / ROTATE (R) / SCALE (S) / EXTRUDE (E)
   ------------------------------------------------------------------------- */
let modal = {
  active:false, type:null, axis:null, dragStyle:'toggle',
  lastX:0, lastY:0, value:0, moveAccum:null,
  objStart:null, vertStart:null, pivot:null, extrudeInfo:null, insetInfo:null,
  meshSnapshot:null, selectionSnapshot:null,
};

function startModal(type, e){
  if(!selectedObject || !canEdit) return;
  if((type==='extrude'||type==='inset') && (editSelectMode!=='face' || editSelection.faces.size===0)) return;
  pushUndo();
  modal.active=true; modal.type=type; modal.axis=null; modal.dragStyle='toggle';
  modal.lastX = e?e.clientX:lastMouseX; modal.lastY = e?e.clientY:lastMouseY;
  modal.value = (type==='scale')?1:0;
  modal.moveAccum = new THREE.Vector3(0,0,0);

  if(!editMode){
    modal.objStart = {
      position: selectedObject.position.clone(),
      rotation: selectedObject.rotation.clone(),
      scale: selectedObject.scale.clone(),
    };
    modal.pivot = selectedObject.position.clone();
  } else {
    const idxs = selectedVertexIndicesForTransform();
    if(idxs.length===0){ modal.active=false; undoStack.pop(); return; }
    modal.vertStart = new Map();
    idxs.forEach(i=> modal.vertStart.set(i, selectedObject.baseMesh.vertices[i].slice()));
    let cx=0,cy=0,cz=0;
    idxs.forEach(i=>{const p=selectedObject.baseMesh.vertices[i]; cx+=p[0];cy+=p[1];cz+=p[2];});
    cx/=idxs.length; cy/=idxs.length; cz/=idxs.length;
    modal.pivot = new THREE.Vector3(cx,cy,cz).applyEuler(selectedObject.rotation).multiply(selectedObject.scale).add(selectedObject.position);

    if(type==='extrude' || type==='inset'){
      // snapshot completo (no solo posiciones) para poder revertir la topología entera si se cancela
      modal.meshSnapshot = {
        vertices: selectedObject.baseMesh.vertices.map(p=>p.slice()),
        faces: selectedObject.baseMesh.faces.map(f=>f.slice())
      };
      modal.selectionSnapshot = new Set(editSelection.faces);
    }

    if(type==='extrude'){
      const data = selectedObject.baseMesh;
      const facesSel = [...editSelection.faces];
      const V=data.vertices, F=data.faces;
      const newFacesInfo=[];
      facesSel.forEach(fi=>{
        const face=F[fi];
        const n=polygonNormal(V,face);
        const base=V.length;
        face.forEach(vi=>V.push(V[vi].slice()));
        const newIdx=face.map((_,k)=>base+k);
        newFacesInfo.push({face:face.slice(), newIdx, normal:n});
      });
      const keepFaces = F.filter((f,fi)=>!editSelection.faces.has(fi));
      newFacesInfo.forEach(info=>{
        info.topFaceIndex = keepFaces.length; // índice real de la cara superior (antes se calculaba mal)
        keepFaces.push(info.newIdx.slice());
        const k=info.face.length;
        const c = polygonCentroid(V, info.face);
        for(let e=0;e<k;e++){
          const a=info.face[e], b=info.face[(e+1)%k];
          const na=info.newIdx[e], nb=info.newIdx[(e+1)%k];
          const mid=v3scale(v3add(V[a],V[b]),0.5);
          const outward=v3sub(mid,c);
          pushQuadOriented(V,keepFaces,a,b,nb,na,outward);
        }
      });
      data.faces = keepFaces;
      editSelection.faces = new Set(newFacesInfo.map(info=>info.topFaceIndex)); // selección correcta de las caras extruidas
      modal.extrudeInfo = newFacesInfo;
      modal.vertStart = new Map();
      newFacesInfo.forEach(info=> info.newIdx.forEach(vi=>{ modal.vertStart.set(vi, data.vertices[vi].slice()); }));
      modal.axis='normal';
      syncEditFromData();
    } else if(type==='inset'){
      const data = selectedObject.baseMesh;
      const facesSel = [...editSelection.faces];
      const V=data.vertices, F=data.faces;
      const insetInfo=[];
      facesSel.forEach(fi=>{
        const face=F[fi];
        const c=polygonCentroid(V,face);
        const insetIdx = face.map(vi=>{ V.push(V[vi].slice()); return V.length-1; }); // empiezan coincidentes (t=0)
        insetInfo.push({face:face.slice(), insetIdx, centroid:c});
      });
      const keepFaces = F.filter((f,fi)=>!editSelection.faces.has(fi));
      insetInfo.forEach(info=>{
        info.innerFaceIndex = keepFaces.length;
        keepFaces.push(info.insetIdx.slice());
        const k=info.face.length;
        for(let e=0;e<k;e++){
          const a=info.face[e], b=info.face[(e+1)%k];
          const ia=info.insetIdx[e], ib=info.insetIdx[(e+1)%k];
          const mid=v3scale(v3add(V[a],V[b]),0.5);
          const outward=v3sub(mid, info.centroid);
          pushQuadOriented(V,keepFaces,a,b,ib,ia,outward);
        }
      });
      data.faces = keepFaces;
      editSelection.faces = new Set(insetInfo.map(info=>info.innerFaceIndex));
      modal.insetInfo = insetInfo;
      modal.vertStart = new Map();
      insetInfo.forEach(info=> info.insetIdx.forEach(vi=>{ modal.vertStart.set(vi, data.vertices[vi].slice()); }));
      modal.axis=null;
      syncEditFromData();
    }
  }
  showModalHint();
  updateConstraintLine();
}

function setModalAxis(ax){
  if(!modal.active || modal.type==='extrude') return;
  modal.axis = (modal.axis===ax) ? null : ax;
  modal.value = (modal.type==='scale')?1:0;
  modal.moveAccum.set(0,0,0);
  updateModalHint('');
  updateConstraintLine();
}

function vecStr(v){ return `X:${v.x.toFixed(2)} Y:${v.y.toFixed(2)} Z:${v.z.toFixed(2)}`; }

function handleModalMouseMove(e){
  if(!modal.active) return;
  const dx = e.clientX - modal.lastX;
  const dy = e.clientY - modal.lastY;
  modal.lastX = e.clientX; modal.lastY = e.clientY;
  const shiftFactor = e.shiftKey ? 0.12 : 1;
  const cam=activeCamera();

  if(modal.type==='move' || modal.type==='extrude'){
    const distScale = ((activeCamKind==='persp') ? modal.pivot.distanceTo(cam.position)*0.0016 : (orbit.radius*0.0022)) * shiftFactor;
    if(modal.axis==='normal' && modal.extrudeInfo){
      const n=modal.extrudeInfo[0].normal;
      const nWorld=new THREE.Vector3(n[0],n[1],n[2]).applyEuler(selectedObject.rotation).normalize();
      const p0=worldToScreen(modal.pivot), p1=worldToScreen(modal.pivot.clone().add(nWorld));
      const sd=new THREE.Vector2(p1.x-p0.x,p1.y-p0.y); const len=sd.length()||1; sd.divideScalar(len);
      modal.value += (dx*sd.x+dy*sd.y)*distScale;
      applyExtrudeOffset(modal.value);
      updateModalHint(modal.value.toFixed(3));
    } else if(modal.axis){
      const axisVec = modal.axis==='x'?new THREE.Vector3(1,0,0): modal.axis==='y'?new THREE.Vector3(0,1,0): new THREE.Vector3(0,0,1);
      const p0=worldToScreen(modal.pivot), p1=worldToScreen(modal.pivot.clone().add(axisVec));
      const sd=new THREE.Vector2(p1.x-p0.x,p1.y-p0.y); const len=sd.length()||1; sd.divideScalar(len);
      modal.value += (dx*sd.x+dy*sd.y)*distScale;
      applyMove(axisVec.clone().multiplyScalar(modal.value));
      updateModalHint(modal.axis.toUpperCase()+': '+modal.value.toFixed(3));
    } else {
      const right=new THREE.Vector3(), fwd=new THREE.Vector3();
      cam.getWorldDirection(fwd);
      right.crossVectors(fwd, cam.up).normalize();
      const camUp=new THREE.Vector3().crossVectors(right,fwd).normalize();
      modal.moveAccum.addScaledVector(right, dx*distScale);
      modal.moveAccum.addScaledVector(camUp, -dy*distScale);
      applyMove(modal.moveAccum.clone());
      updateModalHint(vecStr(modal.moveAccum));
    }
  } else if(modal.type==='rotate'){
    modal.value += (dx-dy)*0.008*shiftFactor;
    applyRotate(modal.value);
    updateModalHint((modal.value*180/Math.PI).toFixed(1)+'°');
  } else if(modal.type==='scale'){
    modal.value = Math.max(0.001, modal.value*(1+(dx-dy)*0.006*shiftFactor));
    applyScale(modal.value);
    updateModalHint(modal.value.toFixed(3));
  } else if(modal.type==='inset'){
    modal.value = Math.max(0, Math.min(0.9, modal.value + (dx-dy)*0.004*shiftFactor));
    applyInset(modal.value);
    updateModalHint('Inset: '+modal.value.toFixed(3));
  }
}

function applyMove(deltaWorld){
  if(!editMode){
    selectedObject.position.copy(modal.objStart.position.clone().add(deltaWorld));
    selectedObject.syncTransform();
  } else {
    const q = new THREE.Quaternion().setFromEuler(selectedObject.rotation).invert();
    const local = deltaWorld.clone().applyQuaternion(q);
    local.x/=selectedObject.scale.x||1; local.y/=selectedObject.scale.y||1; local.z/=selectedObject.scale.z||1;
    modal.vertStart.forEach((start,idx)=>{
      const p = selectedObject.baseMesh.vertices[idx];
      p[0]=start[0]+local.x; p[1]=start[1]+local.y; p[2]=start[2]+local.z;
    });
    syncEditFromData();
  }
}
function applyExtrudeOffset(amount){
  modal.extrudeInfo.forEach(info=>{
    const n=info.normal;
    info.newIdx.forEach(vi=>{
      const start=modal.vertStart.get(vi);
      const p=selectedObject.baseMesh.vertices[vi];
      p[0]=start[0]+n[0]*amount; p[1]=start[1]+n[1]*amount; p[2]=start[2]+n[2]*amount;
    });
  });
  syncEditFromData();
}
function applyInset(t){
  modal.insetInfo.forEach(info=>{
    info.insetIdx.forEach((vi,k)=>{
      const orig = selectedObject.baseMesh.vertices[info.face[k]]; // vértice ORIGINAL, intacto, siempre disponible
      const c = info.centroid;
      const p = selectedObject.baseMesh.vertices[vi];
      p[0]=orig[0]+(c[0]-orig[0])*t;
      p[1]=orig[1]+(c[1]-orig[1])*t;
      p[2]=orig[2]+(c[2]-orig[2])*t;
    });
  });
  syncEditFromData();
}
function modalPivotLocal(){
  let cx=0,cy=0,cz=0,n=0;
  modal.vertStart.forEach(p=>{cx+=p[0];cy+=p[1];cz+=p[2];n++;});
  return new THREE.Vector3(cx/n,cy/n,cz/n);
}
function applyRotate(angle){
  const axisVec = modal.axis==='x'?new THREE.Vector3(1,0,0): modal.axis==='y'?new THREE.Vector3(0,1,0): new THREE.Vector3(0,0,1);
  if(!editMode){
    const q = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
    const startQ = new THREE.Quaternion().setFromEuler(modal.objStart.rotation);
    selectedObject.rotation.setFromQuaternion(q.multiply(startQ));
    selectedObject.syncTransform();
  } else {
    const invQObj = new THREE.Quaternion().setFromEuler(selectedObject.rotation).invert();
    const localAxis = axisVec.clone().applyQuaternion(invQObj).normalize();
    const ql = new THREE.Quaternion().setFromAxisAngle(localAxis, angle);
    const piv = modalPivotLocal();
    modal.vertStart.forEach((start,idx)=>{
      const v=new THREE.Vector3(start[0]-piv.x, start[1]-piv.y, start[2]-piv.z);
      v.applyQuaternion(ql); v.add(piv);
      const p=selectedObject.baseMesh.vertices[idx];
      p[0]=v.x; p[1]=v.y; p[2]=v.z;
    });
    syncEditFromData();
  }
}
function applyScale(factor){
  if(!editMode){
    const sv=new THREE.Vector3(1,1,1);
    if(modal.axis==='x') sv.set(factor,1,1);
    else if(modal.axis==='y') sv.set(1,factor,1);
    else if(modal.axis==='z') sv.set(1,1,factor);
    else sv.set(factor,factor,factor);
    selectedObject.scale.set(modal.objStart.scale.x*sv.x, modal.objStart.scale.y*sv.y, modal.objStart.scale.z*sv.z);
    selectedObject.syncTransform();
  } else {
    const piv = modalPivotLocal();
    modal.vertStart.forEach((start,idx)=>{
      let x=start[0]-piv.x, y=start[1]-piv.y, z=start[2]-piv.z;
      if(!modal.axis){ x*=factor;y*=factor;z*=factor; }
      else if(modal.axis==='x') x*=factor;
      else if(modal.axis==='y') y*=factor;
      else z*=factor;
      const p=selectedObject.baseMesh.vertices[idx];
      p[0]=x+piv.x; p[1]=y+piv.y; p[2]=z+piv.z;
    });
    syncEditFromData();
  }
}

function confirmModal(){
  if(!modal.active) return;
  modal.active=false;
  modal.meshSnapshot=null; modal.selectionSnapshot=null;
  hideModalHint();
  updateConstraintLine();
  if(!editMode){ selectedObject.rebuild(); }
  else { syncEditFromData(); }
  refreshNPanel();
  setStatus('');
  if(onModalOrEditModeEnded) onModalOrEditModeEnded();
}
function cancelModal(){
  if(!modal.active) return;
  if(!editMode){
    selectedObject.position.copy(modal.objStart.position);
    selectedObject.rotation.copy(modal.objStart.rotation);
    selectedObject.scale.copy(modal.objStart.scale);
    selectedObject.syncTransform();
  } else if(modal.meshSnapshot){
    // extrude/inset crearon topología nueva: revertimos la malla entera, no solo posiciones
    selectedObject.baseMesh.vertices = modal.meshSnapshot.vertices;
    selectedObject.baseMesh.faces = modal.meshSnapshot.faces;
    editSelection.faces = new Set(modal.selectionSnapshot);
    syncEditFromData();
  } else {
    modal.vertStart.forEach((start,idx)=>{
      const p=selectedObject.baseMesh.vertices[idx];
      if(p){ p[0]=start[0]; p[1]=start[1]; p[2]=start[2]; }
    });
    syncEditFromData();
  }
  modal.meshSnapshot=null; modal.selectionSnapshot=null;
  modal.active=false;
  hideModalHint();
  updateConstraintLine();
  if(undoStack.length) undoStack.pop(); // no hubo cambio real: descartar el snapshot
  refreshNPanel();
  setStatus('');
  if(onModalOrEditModeEnded) onModalOrEditModeEnded();
}

function showModalHint(){ document.getElementById('modal-hint').style.display='block'; updateModalHint(''); }
function hideModalHint(){ document.getElementById('modal-hint').style.display='none'; }
function updateModalHint(valStr){
  const el=document.getElementById('modal-hint');
  const names={move:'Mover',rotate:'Rotar',scale:'Escalar',extrude:'Extruir'};
  const axisTag = modal.axis && modal.axis!=='normal' ? `<span class="axis-tag axis-${modal.axis}">${modal.axis.toUpperCase()}</span>` : (modal.axis==='normal' ? `<span class="axis-tag" style="background:#888">NORMAL</span>` : '');
  el.innerHTML = `${names[modal.type]||modal.type} ${axisTag} ${valStr}　${modal.dragStyle==='press'?'(soltar = confirmar)':'(clic/Enter = confirmar, clic-der/Esc = cancelar)'}`;
}

/* ---- Línea de restricción de eje (como el "rail" de Blender al pulsar X/Y/Z) ---- */
let constraintLine=null;
function updateConstraintLine(){
  if(constraintLine){ scene.remove(constraintLine); constraintLine.geometry.dispose(); constraintLine.material.dispose(); constraintLine=null; }
  if(!modal.active || !modal.axis || !selectedObject) return;
  let dir, color;
  if(modal.axis==='normal' && modal.extrudeInfo){
    const n=modal.extrudeInfo[0].normal;
    dir=new THREE.Vector3(n[0],n[1],n[2]).applyEuler(selectedObject.rotation).normalize();
    color=0xffffff;
  } else {
    dir = modal.axis==='x'?new THREE.Vector3(1,0,0): modal.axis==='y'?new THREE.Vector3(0,1,0): new THREE.Vector3(0,0,1);
    color = modal.axis==='x'?0xe0524d: modal.axis==='y'?0x8fd34c:0x4f9fe8;
  }
  const L=500;
  const pts=[modal.pivot.clone().addScaledVector(dir,-L), modal.pivot.clone().addScaledVector(dir,L)];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const mat=new THREE.LineDashedMaterial({color, dashSize:0.18, gapSize:0.12, transparent:true, opacity:0.9, depthTest:false});
  constraintLine=new THREE.Line(geo,mat);
  constraintLine.computeLineDistances();
  constraintLine.renderOrder=9997;
  scene.add(constraintLine);
}

/* -------------------------------------------------------------------------
   12. RATÓN: navegación + gizmo + modal (un único listener por evento)
   ------------------------------------------------------------------------- */
let lastMouseX=innerWidth/2, lastMouseY=innerHeight/2;

canvas.addEventListener('mousedown',(e)=>{
  if(e.button===1){
    nav.dragging=true;
    nav.mode = e.shiftKey?'pan':(e.ctrlKey?'dolly':'orbit');
    nav.lastX=e.clientX; nav.lastY=e.clientY;
    e.preventDefault();
    return;
  }
  if(loopCutMode){
    if(e.button===0){ commitLoopCutFromPreview(); } else if(e.button===2){ exitLoopCutMode(); }
    e.preventDefault();
    return;
  }
  if(modal.active){
    if(e.button===0){ confirmModal(); } else if(e.button===2){ cancelModal(); }
    e.preventDefault();
    return;
  }
  if(e.button===0){
    if(tryGizmoDrag(e)) return;
    handleViewportClick(e);
  }
});
window.addEventListener('mousemove',(e)=>{
  lastMouseX=e.clientX; lastMouseY=e.clientY;
  if(modal.active){ handleModalMouseMove(e); return; }
  if(!nav.dragging){ if(loopCutMode) updateLoopCutPreview(e); return; }
  const dx=e.clientX-nav.lastX, dy=e.clientY-nav.lastY;
  nav.lastX=e.clientX; nav.lastY=e.clientY;
  if(nav.mode==='orbit'){
    orbit.theta -= dx*0.006;
    orbit.phi = Math.max(0.02, Math.min(Math.PI-0.02, orbit.phi - dy*0.006));
  } else if(nav.mode==='pan'){
    const cam=activeCamera();
    const forward=new THREE.Vector3(); cam.getWorldDirection(forward);
    const right=new THREE.Vector3().crossVectors(forward, cam.up).normalize();
    const camUp=new THREE.Vector3().crossVectors(right,forward).normalize();
    const panScale = orbit.radius*0.0016;
    orbit.target.addScaledVector(right, -dx*panScale);
    orbit.target.addScaledVector(camUp, dy*panScale);
  } else if(nav.mode==='dolly'){
    orbit.radius = Math.max(0.5, Math.min(400, orbit.radius*(1+dy*0.003)));
  }
  updateCameraFromOrbit();
});
window.addEventListener('mouseup',(e)=>{
  if(e.button===1) nav.dragging=false;
  if(e.button===0 && modal.active && modal.dragStyle==='press'){ confirmModal(); }
});
window.addEventListener('contextmenu',(e)=>{ if(modal.active) e.preventDefault(); });

/* -------------------------------------------------------------------------
   13. ATAJOS DE TECLADO GLOBALES
   ------------------------------------------------------------------------- */
window.addEventListener('keydown',(e)=>{
  if(document.activeElement && ['INPUT','SELECT'].includes(document.activeElement.tagName)){
    if(e.key==='Escape') document.activeElement.blur();
    return;
  }
  handleGlobalKey(e);
});

function handleGlobalKey(e){
  const k=e.key;

  if((k==='z'||k==='Z') && (e.ctrlKey||e.metaKey)){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if((k==='y'||k==='Y') && (e.ctrlKey||e.metaKey)){ e.preventDefault(); redo(); return; }
  if((k==='r'||k==='R') && (e.ctrlKey||e.metaKey)){
    e.preventDefault(); // antes esto recargaba la página; ahora abre/cierra Loop Cut
    if(loopCutMode){ exitLoopCutMode(); }
    else if(editMode && canEdit){ enterLoopCutMode(); }
    return;
  }

  if(loopCutMode){
    if(k==='Escape'){ exitLoopCutMode(); }
    return;
  }

  if(modal.active){
    if(k==='Escape'){ cancelModal(); return; }
    if(k==='Enter'){ confirmModal(); return; }
    if(k==='x'||k==='X'){ setModalAxis('x'); return; }
    if(k==='y'||k==='Y'){ setModalAxis('y'); return; }
    if(k==='z'||k==='Z'){ setModalAxis('z'); return; }
    return;
  }

  if(k==='Tab'){ e.preventDefault(); const next=editMode?'object':'edit'; document.getElementById('mode-select').value=next; setMode(next); return; }
  if(k==='n'||k==='N'){ togglePanel(); return; }
  if(k==='g'||k==='G'){ startModal('move',{clientX:lastMouseX,clientY:lastMouseY}); return; }
  if(k==='r'||k==='R'){ startModal('rotate',{clientX:lastMouseX,clientY:lastMouseY}); return; }
  if(k==='s'||k==='S'){ startModal('scale',{clientX:lastMouseX,clientY:lastMouseY}); return; }
  if((k==='e'||k==='E') && editMode){ startModal('extrude',{clientX:lastMouseX,clientY:lastMouseY}); return; }
  if((k==='i'||k==='I') && editMode){ startModal('inset',{clientX:lastMouseX,clientY:lastMouseY}); return; }
  if(k==='Delete' || k==='x' || k==='X'){
    if(!editMode && selectedObject){ deleteObject(selectedObject); }
    else if(editMode && selectedObject){ deleteSelectedGeometry(); }
    return;
  }
  if((k==='d'||k==='D') && e.shiftKey && !editMode && selectedObject){ duplicateObject(selectedObject); return; }
  if(k==='a'||k==='A'){
    if(editMode){
      pushUndo();
      if(e.altKey){ editSelection.verts.clear(); editSelection.edges.clear(); editSelection.faces.clear(); }
      else if(editSelectMode==='vertex'){ selectedObject.baseMesh.vertices.forEach((_,i)=>editSelection.verts.add(i)); }
      else if(editSelectMode==='edge'){ buildEdgeList(selectedObject.baseMesh).forEach((_,i)=>editSelection.edges.add(i)); }
      else { selectedObject.baseMesh.faces.forEach((_,i)=>editSelection.faces.add(i)); }
      if(undoStack.length) undoStack.pop(); // selección no es geometría: no hace falta deshacer
      syncEditFromData();
    }
    return;
  }
  if(editMode && k==='1'){ setEditSubmode('vertex'); return; }
  if(editMode && k==='2'){ setEditSubmode('edge'); return; }
  if(editMode && k==='3'){ setEditSubmode('face'); return; }

  if(k==='7'){ setView(orbit.theta, 0.001); return; }
  if(!editMode && k==='1'){ setView(-Math.PI/2, Math.PI/2); return; }
  if(!editMode && k==='3'){ setView(0, Math.PI/2); return; }
  if(k==='5'){ activeCamKind = activeCamKind==='persp'?'ortho':'persp'; return; }
  if(k==='.'){ frameSelected(); return; }
  if(k==='z'||k==='Z'){ toggleWireOverlay(); return; }
}

function deleteSelectedGeometry(){
  if(!canEdit) return;
  pushUndo();
  const data=selectedObject.baseMesh;
  if(editSelectMode==='face' && editSelection.faces.size){
    data.faces = data.faces.filter((f,i)=>!editSelection.faces.has(i));
    editSelection.faces.clear();
  } else if(editSelectMode==='edge' && editSelection.edges.size){
    const edgeList = buildEdgeList(data);
    const selKeys = new Set();
    editSelection.edges.forEach(i=>{ const e=edgeList[i]; if(e) selKeys.add(edgeKey(e[0],e[1])); });
    data.faces = data.faces.filter(f=>{
      const k=f.length;
      for(let i=0;i<k;i++){ if(selKeys.has(edgeKey(f[i],f[(i+1)%k]))) return false; }
      return true;
    });
    editSelection.edges.clear();
  } else if(editSelectMode==='vertex' && editSelection.verts.size){
    const remove = editSelection.verts;
    data.faces = data.faces.filter(f=>!f.some(vi=>remove.has(vi)));
    const remap=new Map(); const newV=[];
    data.vertices.forEach((p,i)=>{ if(!remove.has(i)){ remap.set(i,newV.length); newV.push(p);} });
    data.faces = data.faces.map(f=>f.map(vi=>remap.get(vi)));
    data.vertices = newV;
    editSelection.verts.clear();
  } else {
    if(undoStack.length) undoStack.pop();
    return;
  }
  syncEditFromData();
}

function duplicateObject(obj){
  if(!canEdit) return;
  pushUndo();
  const data = {vertices:obj.baseMesh.vertices.map(p=>p.slice()), faces:obj.baseMesh.faces.map(f=>f.slice())};
  objCounter[obj.kind]=(objCounter[obj.kind]||0)+1;
  const n = new SceneObject(obj.kind, data, obj.name+'.copy');
  n.position.copy(obj.position); n.rotation.copy(obj.rotation); n.scale.copy(obj.scale);
  n.color = obj.color; n.smooth = obj.smooth;
  n.modifiers = obj.modifiers.map(m=>({type:m.type, params:{...m.params}}));
  n.syncTransform(); n.rebuild();
  objects.push(n);
  selectObject(n);
  refreshOutliner();
  startModal('move', {clientX:lastMouseX, clientY:lastMouseY});
  if(undoStack.length) undoStack.pop(); // el pushUndo del startModal duplicaba el snapshot; nos quedamos con el primero
}

function frameSelected(){
  if(!selectedObject) return;
  orbit.target.copy(selectedObject.position);
  updateCameraFromOrbit();
}
let wireOverlay=false;
function toggleWireOverlay(){
  wireOverlay=!wireOverlay;
  objects.forEach(o=>{ o.material.wireframe = wireOverlay; });
  document.getElementById('shade-wire').classList.toggle('active', wireOverlay);
}

/* -------------------------------------------------------------------------
   14. DESHACER / REHACER (Ctrl+Z / Ctrl+Shift+Z)
   ------------------------------------------------------------------------- */
let undoStack=[], redoStack=[];
const UNDO_LIMIT=80;
let appReady=false;

function snapshotState(){
  return {
    objects: objects.map(o=>({
      kind:o.kind, name:o.name, smooth:o.smooth, color:o.color,
      baseMesh:{vertices:o.baseMesh.vertices.map(p=>p.slice()), faces:o.baseMesh.faces.map(f=>f.slice())},
      modifiers:o.modifiers.map(m=>({type:m.type, params:{...m.params}})),
      position:[o.position.x,o.position.y,o.position.z],
      rotation:[o.rotation.x,o.rotation.y,o.rotation.z],
      scale:[o.scale.x,o.scale.y,o.scale.z],
    })),
    selectedIndex: selectedObject ? objects.indexOf(selectedObject) : -1,
    objCounter:{...objCounter}, paletteIdx,
  };
}
function pushUndo(){
  if(!appReady) return;
  undoStack.push(snapshotState());
  if(undoStack.length>UNDO_LIMIT) undoStack.shift();
  redoStack.length=0;
  updateUndoButtons();
}
function restoreState(snap, opts={}){
  objects.forEach(o=>o.dispose());
  objects=[];
  snap.objects.forEach(sd=>{
    const data={vertices:sd.baseMesh.vertices.map(p=>p.slice()), faces:sd.baseMesh.faces.map(f=>f.slice())};
    const o=new SceneObject(sd.kind, data, sd.name);
    o.smooth=sd.smooth; o.color=sd.color;
    o.modifiers=sd.modifiers.map(m=>({type:m.type, params:{...m.params}}));
    o.position.set(sd.position[0],sd.position[1],sd.position[2]);
    o.rotation.set(sd.rotation[0],sd.rotation[1],sd.rotation[2]);
    o.scale.set(sd.scale[0],sd.scale[1],sd.scale[2]);
    o.syncTransform(); o.rebuild();
    objects.push(o);
  });
  objCounter={...snap.objCounter}; paletteIdx=snap.paletteIdx;
  let toSelect=null;
  if(opts.preserveSelectionByName){
    toSelect = objects.find(o=>o.name===opts.preserveSelectionByName) || null;
  }
  if(!toSelect){
    toSelect = snap.selectedIndex>=0 ? objects[snap.selectedIndex] : null;
  }
  selectObject(toSelect);
  refreshOutliner();
}
function undo(){
  if(!canEdit){ setStatus('Solo quien modela puede deshacer'); return; }
  if(undoStack.length===0){ setStatus('Nada que deshacer'); return; }
  const wasEdit=editMode;
  if(editMode){ clearEditHelpers(); editMode=false; }
  redoStack.push(snapshotState());
  restoreState(undoStack.pop());
  if(wasEdit && selectedObject){ document.getElementById('mode-select').value='edit'; enterEditMode(); }
  else { document.getElementById('mode-select').value='object'; }
  updateUndoButtons();
  setStatus('Deshecho');
}
function redo(){
  if(!canEdit){ setStatus('Solo quien modela puede rehacer'); return; }
  if(redoStack.length===0){ setStatus('Nada que rehacer'); return; }
  const wasEdit=editMode;
  if(editMode){ clearEditHelpers(); editMode=false; }
  undoStack.push(snapshotState());
  restoreState(redoStack.pop());
  if(wasEdit && selectedObject){ document.getElementById('mode-select').value='edit'; enterEditMode(); }
  updateUndoButtons();
  setStatus('Rehecho');
}
function updateUndoButtons(){
  document.getElementById('btn-undo').disabled = undoStack.length===0;
  document.getElementById('btn-redo').disabled = redoStack.length===0;
}
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

/* Registra un snapshot de undo una sola vez por interacción (al empezar a arrastrar un slider/input) */
function armUndoOnce(el){
  let armed=false;
  el.addEventListener('pointerdown', ()=>{ if(!armed){ pushUndo(); armed=true; } });
  el.addEventListener('blur', ()=>{ armed=false; });
}

/* -------------------------------------------------------------------------
   15. UI: TOP BAR / TOOLBAR / MODE SELECT
   ------------------------------------------------------------------------- */
document.getElementById('btn-add-menu').addEventListener('click', (e)=>{
  document.getElementById('add-dropdown').classList.toggle('open');
  e.stopPropagation();
});
window.addEventListener('click', ()=> document.getElementById('add-dropdown').classList.remove('open'));
document.querySelectorAll('#add-dropdown .dd-item').forEach(el=>{
  el.addEventListener('click', ()=>{ addObject(el.dataset.add); document.getElementById('add-dropdown').classList.remove('open'); });
});

document.getElementById('mode-select').addEventListener('change', (e)=> setMode(e.target.value));
function setMode(mode){
  document.getElementById('mode-select').value=mode;
  if(mode==='edit') enterEditMode(); else exitEditMode();
}
document.querySelectorAll('.sub-btn').forEach(b=> b.addEventListener('click', ()=> setEditSubmode(b.dataset.submode)));

document.querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
  });
});

document.getElementById('shade-wire').addEventListener('click', toggleWireOverlay);
document.getElementById('btn-shade-smooth').addEventListener('click', ()=>{ if(selectedObject){ pushUndo(); selectedObject.smooth=true; selectedObject.rebuild(); } });
document.getElementById('btn-shade-flat').addEventListener('click', ()=>{ if(selectedObject){ pushUndo(); selectedObject.smooth=false; selectedObject.rebuild(); } });

/* -------------------------------------------------------------------------
   16. PANEL N (transform)
   ------------------------------------------------------------------------- */
function togglePanel(){
  const p=document.getElementById('npanel');
  p.style.display = (p.style.display==='flex') ? 'none' : 'flex';
}
const nPx=document.getElementById('n-px'),nPy=document.getElementById('n-py'),nPz=document.getElementById('n-pz');
const nRx=document.getElementById('n-rx'),nRy=document.getElementById('n-ry'),nRz=document.getElementById('n-rz');
const nSx=document.getElementById('n-sx'),nSy=document.getElementById('n-sy'),nSz=document.getElementById('n-sz');
[nPx,nPy,nPz,nRx,nRy,nRz,nSx,nSy,nSz].forEach(inp=>{
  armUndoOnce(inp);
  inp.addEventListener('input', ()=>{
    if(!selectedObject) return;
    selectedObject.position.set(parseFloat(nPx.value)||0, parseFloat(nPy.value)||0, parseFloat(nPz.value)||0);
    selectedObject.rotation.set((parseFloat(nRx.value)||0)*Math.PI/180,(parseFloat(nRy.value)||0)*Math.PI/180,(parseFloat(nRz.value)||0)*Math.PI/180);
    selectedObject.scale.set(parseFloat(nSx.value)||1, parseFloat(nSy.value)||1, parseFloat(nSz.value)||1);
    selectedObject.syncTransform();
  });
});
function refreshNPanel(){
  if(!selectedObject){ document.getElementById('n-dims').textContent='–'; return; }
  const o=selectedObject;
  nPx.value=o.position.x.toFixed(3); nPy.value=o.position.y.toFixed(3); nPz.value=o.position.z.toFixed(3);
  nRx.value=(o.rotation.x*180/Math.PI).toFixed(1); nRy.value=(o.rotation.y*180/Math.PI).toFixed(1); nRz.value=(o.rotation.z*180/Math.PI).toFixed(1);
  nSx.value=o.scale.x.toFixed(3); nSy.value=o.scale.y.toFixed(3); nSz.value=o.scale.z.toFixed(3);
  const box=new THREE.Box3().setFromObject(o.mesh);
  const size=new THREE.Vector3(); box.getSize(size);
  document.getElementById('n-dims').textContent = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`;
}

/* -------------------------------------------------------------------------
   17. OUTLINER
   ------------------------------------------------------------------------- */
function refreshOutliner(){
  const list=document.getElementById('ol-list');
  list.innerHTML='';
  objects.forEach(o=>{
    const div=document.createElement('div');
    div.className='ol-item'+(o===selectedObject?' selected':'');
    div.innerHTML = `<span class="ol-icon">▣</span><span>${o.name}</span>`;
    div.addEventListener('click', ()=> selectObject(o));
    list.appendChild(div);
  });
}

/* -------------------------------------------------------------------------
   18. PROPERTIES: OBJECT / MODIFIERS / MATERIAL
   ------------------------------------------------------------------------- */
let currentPTab='object';
document.querySelectorAll('.ptab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.ptab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    currentPTab=t.dataset.ptab;
    renderPropTab();
  });
});
function renderPropTab(){
  if(currentPTab==='object') refreshPropObject();
  else if(currentPTab==='modifiers') refreshPropModifiers();
  else refreshPropMaterial();
}

function refreshPropObject(){
  if(currentPTab!=='object') return;
  const el=document.getElementById('prop-content');
  if(!selectedObject){ el.innerHTML='<h4>Objeto</h4><p style="color:#888">Ningún objeto seleccionado.</p>'; return; }
  el.innerHTML = `
    <h4>Objeto: ${selectedObject.name}</h4>
    <div class="prop-block">
      <div class="row"><label>Nombre</label><input type="text" id="obj-name" value="${selectedObject.name}"></div>
      <div class="row"><label>Tipo</label><span style="color:#aaa">${selectedObject.kind}</span></div>
      <div class="row"><label>Sombreado</label>
        <select id="obj-shade">
          <option value="flat">Plano</option>
          <option value="smooth">Suave</option>
        </select>
      </div>
    </div>`;
  document.getElementById('obj-shade').value = selectedObject.smooth?'smooth':'flat';
  document.getElementById('obj-shade').addEventListener('change', (e)=>{ pushUndo(); selectedObject.smooth = e.target.value==='smooth'; selectedObject.rebuild(); });
  const nameInp=document.getElementById('obj-name');
  armUndoOnce(nameInp);
  nameInp.addEventListener('input', (e)=>{ selectedObject.name=e.target.value; refreshOutliner(); });
}

function refreshPropMaterial(){
  if(currentPTab!=='material') return;
  const el=document.getElementById('prop-content');
  if(!selectedObject){ el.innerHTML='<h4>Material</h4><p style="color:#888">Ningún objeto seleccionado.</p>'; return; }
  const hex = '#'+selectedObject.color.toString(16).padStart(6,'0');
  el.innerHTML = `
    <h4>Material (Preview)</h4>
    <div class="prop-block">
      <div class="row"><label>Color base</label><input type="color" id="mat-color" value="${hex}"></div>
      <div class="row"><label>Rugosidad</label><input type="range" min="0" max="1" step="0.01" id="mat-rough" value="${selectedObject.material.roughness}"></div>
      <div class="row"><label>Metalicidad</label><input type="range" min="0" max="1" step="0.01" id="mat-metal" value="${selectedObject.material.metalness}"></div>
    </div>
    <p style="color:#888;font-size:11px;">Sin motor de render: previsualización de material con iluminación de estudio simple y colores planos.</p>`;
  const colorInp=document.getElementById('mat-color'), roughInp=document.getElementById('mat-rough'), metalInp=document.getElementById('mat-metal');
  [colorInp,roughInp,metalInp].forEach(armUndoOnce);
  colorInp.addEventListener('input', (e)=>{
    selectedObject.color = parseInt(e.target.value.slice(1),16);
    selectedObject.material.color.set(selectedObject.color);
  });
  roughInp.addEventListener('input', (e)=>{ selectedObject.material.roughness=parseFloat(e.target.value); });
  metalInp.addEventListener('input', (e)=>{ selectedObject.material.metalness=parseFloat(e.target.value); });
}

const MODIFIER_DEFS = {
  subsurf: {label:'Subdivision Surface', params:{levels:1}},
  bevel: {label:'Bevel', params:{amount:0.08}},
  array: {label:'Array', params:{count:3, ox:2.2, oy:0, oz:0}},
  mirror: {label:'Mirror', params:{axis:'x'}},
  solidify: {label:'Solidify', params:{thickness:0.15}},
  wireframe: {label:'Wireframe', params:{radius:0.04}},
  simpledeform: {label:'Simple Deform (Twist)', params:{angle:60, axis:'z'}},
};

function refreshPropModifiers(){
  if(currentPTab!=='modifiers') return;
  const el=document.getElementById('prop-content');
  if(!selectedObject){ el.innerHTML='<h4>Modificadores</h4><p style="color:#888">Ningún objeto seleccionado.</p>'; return; }
  let html = `<h4>Modificadores</h4>
    <select id="add-modifier-select"><option value="">+ Añadir Modificador</option>`;
  Object.keys(MODIFIER_DEFS).forEach(k=> html+=`<option value="${k}">${MODIFIER_DEFS[k].label}</option>`);
  html += `</select><div id="mod-list"></div>`;
  el.innerHTML = html;
  document.getElementById('add-modifier-select').addEventListener('change', (e)=>{
    const type=e.target.value;
    if(type){
      pushUndo();
      selectedObject.modifiers.push({type, params:{...MODIFIER_DEFS[type].params}});
      selectedObject.rebuild();
      refreshPropModifiers();
      refreshNPanel();
    }
  });
  const listEl=document.getElementById('mod-list');
  selectedObject.modifiers.forEach((mod,idx)=>{
    const block=document.createElement('div');
    block.className='prop-block';
    let paramsHtml='';
    for(const key in mod.params){
      const val=mod.params[key];
      if(key==='axis'){
        paramsHtml += `<div class="row"><label>Eje</label>
          <select data-mod="${idx}" data-key="${key}">
            <option value="x" ${val==='x'?'selected':''}>X</option>
            <option value="y" ${val==='y'?'selected':''}>Y</option>
            <option value="z" ${val==='z'?'selected':''}>Z</option>
          </select></div>`;
      } else {
        const step = (key==='levels'||key==='count') ? 1 : 0.01;
        paramsHtml += `<div class="row"><label>${paramLabel(key)}</label><input type="number" step="${step}" value="${val}" data-mod="${idx}" data-key="${key}"></div>`;
      }
    }
    block.innerHTML = `
      <div class="prop-block-head">
        <strong>🔧 ${MODIFIER_DEFS[mod.type].label}</strong>
        <span>
          <button class="small-btn" data-up="${idx}" title="Subir">▲</button>
          <button class="small-btn" data-down="${idx}" title="Bajar">▼</button>
          <button class="small-btn danger" data-del="${idx}" title="Eliminar">✕</button>
        </span>
      </div>
      ${paramsHtml}
    `;
    listEl.appendChild(block);
  });
  listEl.querySelectorAll('input[data-mod], select[data-mod]').forEach(inp=>{
    armUndoOnce(inp);
    inp.addEventListener('input', (e)=>{
      const idx=parseInt(e.target.dataset.mod), key=e.target.dataset.key;
      let v = e.target.tagName==='SELECT' ? e.target.value : parseFloat(e.target.value);
      selectedObject.modifiers[idx].params[key]=v;
      selectedObject.rebuild();
      refreshNPanel();
    });
  });
  listEl.querySelectorAll('[data-del]').forEach(b=> b.addEventListener('click', (e)=>{
    pushUndo();
    selectedObject.modifiers.splice(parseInt(e.target.dataset.del),1);
    selectedObject.rebuild(); refreshPropModifiers(); refreshNPanel();
  }));
  listEl.querySelectorAll('[data-up]').forEach(b=> b.addEventListener('click', (e)=>{
    const i=parseInt(e.target.dataset.up);
    if(i>0){ pushUndo(); const arr=selectedObject.modifiers; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; selectedObject.rebuild(); refreshPropModifiers(); }
  }));
  listEl.querySelectorAll('[data-down]').forEach(b=> b.addEventListener('click', (e)=>{
    const i=parseInt(e.target.dataset.down);
    const arr=selectedObject.modifiers;
    if(i<arr.length-1){ pushUndo(); [arr[i+1],arr[i]]=[arr[i],arr[i+1]]; selectedObject.rebuild(); refreshPropModifiers(); }
  }));
}
function paramLabel(k){
  return {levels:'Niveles',amount:'Cantidad',count:'Repeticiones',ox:'Offset X',oy:'Offset Y',oz:'Offset Z',
          thickness:'Espesor',radius:'Radio',angle:'Ángulo (°)'}[k] || k;
}

/* -------------------------------------------------------------------------
   19. INDICADOR DE ORIENTACIÓN (mini-gizmo de ejes, esquina superior derecha)
   ------------------------------------------------------------------------- */
const axisCanvas = document.getElementById('gizmo-canvas');
const actx = axisCanvas.getContext('2d');
function drawOrientationIndicator(){
  const cam=activeCamera();
  const size=90, cx=size/2, cy=size/2, R=32;
  actx.clearRect(0,0,size,size);
  const axes=[
    {v:new THREE.Vector3(1,0,0), color:'#e0524d', label:'X'},
    {v:new THREE.Vector3(0,1,0), color:'#8fd34c', label:'Y'},
    {v:new THREE.Vector3(0,0,1), color:'#4f9fe8', label:'Z'},
  ];
  const invQ = cam.quaternion.clone().invert();
  const items=[];
  axes.forEach(a=>{
    [1,-1].forEach(sign=>{
      const v = a.v.clone().multiplyScalar(sign).applyQuaternion(invQ);
      items.push({x:v.x, y:-v.y, z:v.z, color:a.color, label:sign>0?a.label:'', pos:sign>0});
    });
  });
  items.sort((a,b)=>a.z-b.z);
  items.forEach(it=>{
    const x=cx+it.x*R, y=cy+it.y*R;
    actx.beginPath();
    actx.arc(x,y,it.pos?8:5,0,Math.PI*2);
    actx.strokeStyle = it.color; actx.lineWidth=1.4;
    if(it.pos){ actx.fillStyle=it.color; actx.fill(); }
    else { actx.fillStyle='#2b2b2b'; actx.fill(); actx.stroke(); }
    if(it.label){
      actx.fillStyle='#111'; actx.font='bold 10px sans-serif';
      actx.textAlign='center'; actx.textBaseline='middle';
      actx.fillText(it.label, x, y);
    }
  });
}

/* -------------------------------------------------------------------------
   20. STATUS / OVERLAY
   ------------------------------------------------------------------------- */
function setStatus(msg){ document.getElementById('status-msg').textContent=msg; }
function updateOverlay(){
  const el=document.getElementById('viewport-overlay-top');
  el.innerHTML = `${editMode?('Modo Edición ('+editSelectMode+')'):'Modo Objeto'} — Vista ${activeCamKind==='persp'?'Perspectiva':'Ortográfica'}<br>` +
                  `Objetos: ${objects.length}` + (selectedObject? ` — Seleccionado: ${selectedObject.name}`:'');
}

/* -------------------------------------------------------------------------
   21. LOOP DE RENDER
   ------------------------------------------------------------------------- */
function animate(){
  requestAnimationFrame(animate);
  resize();
  updateGizmoVisibility();
  drawOrientationIndicator();
  updateOverlay();
  renderer.render(scene, activeCamera());
}

/* -------------------------------------------------------------------------
   22. INICIALIZACIÓN
   ------------------------------------------------------------------------- */
addObject('cube', {record:false});
appReady = true;
frameSelected();
refreshPropModifiers();
updateUndoButtons();
animate();
