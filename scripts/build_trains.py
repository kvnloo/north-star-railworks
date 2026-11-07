"""Generate two original, modular locomotives. Run with Blender 4.5+ in background."""
import bpy, math, json, random
from mathutils import Vector
from pathlib import Path
SOURCE_ROOT=Path(__file__).resolve().parents[1]
ROOT=SOURCE_ROOT
CONFIG={}
RENDER=True
random.seed(42)
M={}; GROUPS={}; CACHE={}; CURRENT=None

def mat(name, color, metal=0, rough=.35, emission=0):
    color=CONFIG.get('materials',{}).get(name,color)
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough
    if emission: bs.inputs['Emission Color'].default_value=(*color,1); bs.inputs['Emission Strength'].default_value=emission
    M[name]=m; return m

def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M.clear(); GROUPS.clear(); CACHE.clear()
    random.seed(CONFIG.get('seed',42))
    for name,c,me,r in [('green',(.035,.17,.105),.65,.28),('red',(.29,.032,.022),.6,.3),('navy',(.023,.064,.10),.68,.3),('brass',(.69,.40,.13),.8,.24),('steel',(.44,.54,.58),.85,.25),('black',(.016,.023,.029),.5,.35),('rubber',(.029,.033,.037),.1,.7),('glass',(.08,.23,.27),.5,.15),('coal',(.025,.029,.034),.25,.85),('wood',(.16,.085,.042),.1,.8),('cream',(.82,.73,.54),.15,.5),('floor',(.045,.064,.068),.15,.7)]: mat(name,c,me,r)
    mat('lamp',(1,.70,.30),.1,.2,3)
    scene=bpy.context.scene; scene.name='01 • Assembled'
    scene.render.engine='CYCLES'; scene.cycles.samples=8; scene.cycles.use_denoising=True
    scene.render.resolution_x=1200; scene.render.resolution_y=750; scene.render.resolution_percentage=100
    scene.world=bpy.data.worlds.new('Gallery environment'); scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.32,.4,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG'
    scene.unit_settings.system='METRIC'
    return scene

def group(name):
    global CURRENT
    print('ASSEMBLY',name,flush=True)
    c=bpy.data.collections.new(name); bpy.context.scene.collection.children.link(c); GROUPS[name]=c; CURRENT=c
    return c

def finish(o,name,material,bevel=0):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    CURRENT.objects.link(o)
    if material and not o.data.materials:o.data.materials.append(M[material])
    if bevel:
        b=o.modifiers.new('Machined edge','BEVEL'); b.width=bevel; b.segments=3
        b=o.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return o

def mesh_object(name,key,vertices,faces,p,m,smooth=False):
    if key not in CACHE:
        me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update()
        if smooth:
            for f in me.polygons:f.use_smooth=len(f.vertices)==4
        CACHE[key]=me
    o=bpy.data.objects.new(name,CACHE[key]);o.location=p
    return finish(o,name,m)

def box(name,p,s,m,bevel=.025):
    x,y,z=[v/2 for v in s]
    vs=[(-x,-y,-z),(-x,-y,z),(-x,y,-z),(-x,y,z),(x,-y,-z),(x,-y,z),(x,y,-z),(x,y,z)]
    fs=[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    o=mesh_object(name,('box',tuple(s),m),vs,fs,p,m)
    if bevel:
        mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def cyl(name,p,r,d,m,axis='Z',verts=48,r2=None):
    top=r if r2 is None else r2;vs=[];fs=[]
    for z,rr in [(-d/2,r),(d/2,top)]:
        vs.extend((rr*math.cos(i*math.tau/verts),rr*math.sin(i*math.tau/verts),z) for i in range(verts))
    for i in range(verts):
        j=(i+1)%verts;fs.append((i,j,j+verts,i+verts))
    fs.extend([tuple(range(verts-1,-1,-1)),tuple(range(verts,verts*2))])
    o=mesh_object(name,('cyl',r,d,top,verts,m),vs,fs,p,m,True)
    if axis=='X':o.rotation_euler[1]=math.pi/2
    elif axis=='Y':o.rotation_euler[0]=math.pi/2
    if r>.09:
        mod=o.modifiers.new('Machined edge','BEVEL');mod.width=.008;mod.segments=2
    return o

def ball(name,p,s,m):
    key=('sphere',m)
    if key not in CACHE:
        n=24;k=12;vs=[(0,0,1)];fs=[]
        for j in range(1,k):
            a=math.pi*j/k
            for i in range(n):
                t=math.tau*i/n;vs.append((math.sin(a)*math.cos(t),math.sin(a)*math.sin(t),math.cos(a)))
        vs.append((0,0,-1));bottom=len(vs)-1
        for i in range(n):fs.append((0,1+i,1+(i+1)%n))
        for j in range(k-2):
            for i in range(n):
                a=1+j*n+i;b=1+j*n+(i+1)%n;fs.append((a,a+n,b+n,b))
        for i in range(n):fs.append((bottom,1+(k-2)*n+(i+1)%n,1+(k-2)*n+i))
        o=mesh_object(name,key,vs,fs,p,m,True)
        for f in o.data.polygons:f.use_smooth=True
    else:o=mesh_object(name,key,[],[],p,m)
    o.scale=s;return o

def rod(name,a,b,r,m,verts=16):
    a,b=Vector(a),Vector(b); o=cyl(name,(a+b)/2,r,(b-a).length,m,verts=verts)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler(); return o

def pipe(name,points,r,m):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.bevel_depth=r;cu.bevel_resolution=3
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for q,p in zip(sp.points,points):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);CURRENT.objects.link(o);cu.materials.append(M[m]);return o

def ring(name,p,major,minor,m,axis='Y'):
    key=('ring',major,minor,m);vs=[];fs=[];n=48;k=10
    if key not in CACHE:
        for i in range(n):
            a=math.tau*i/n
            for j in range(k):
                b=math.tau*j/k;rr=major+minor*math.cos(b)
                vs.append((rr*math.cos(a),rr*math.sin(a),minor*math.sin(b)))
        for i in range(n):
            for j in range(k):fs.append((i*k+j,((i+1)%n)*k+j,((i+1)%n)*k+(j+1)%k,i*k+(j+1)%k))
    o=mesh_object(name,key,vs,fs,p,m,True)
    if axis=='X':o.rotation_euler[1]=math.pi/2
    elif axis=='Y':o.rotation_euler[0]=math.pi/2
    return o

def text(name,body,p,size,m,side=-1):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x='CENTER';cu.align_y='CENTER';cu.extrude=.0015
    o=bpy.data.objects.new(name,cu);CURRENT.objects.link(o);o.location=p;cu.materials.append(M[m])
    o.rotation_euler=(math.pi/2,0,0 if side==-1 else math.pi)
    return o

def rivets_line(name,a,b,n,m='brass',r=.024):
    a,b=Vector(a),Vector(b)
    for i in range(n):ball(f'{name} {i+1:02d}',a.lerp(b,i/max(1,n-1)),(r,r,r),m)

def wheel(x,y,z,r,paint,tag):
    ring(tag+' steel tyre',(x,y,z),r-.055,.055,'steel')
    ring(tag+' cast rim',(x,y,z),r-.13,.045,paint)
    cyl(tag+' hub',(x,y,z),.16,.20,paint,'Y')
    cyl(tag+' hub cap',(x,y+math.copysign(.115,y),z),.105,.05,'brass' if paint=='red' else 'steel','Y')
    for j in range(14 if r>.65 else 10):
        a=2*math.pi*j/(14 if r>.65 else 10)
        rod(tag+f' spoke {j+1:02}',(x+.14*math.sin(a),y,z+.14*math.cos(a)),(x+(r-.11)*math.sin(a),y,z+(r-.11)*math.cos(a)),.036 if r>.65 else .027,paint)
    # crescent counterweight, separate from spokes
    for j in range(5):
        a=math.pi*.72+j*.14
        ball(tag+' counterweight',(x+(r-.21)*math.sin(a),y,z+(r-.21)*math.cos(a)),(.13,.065,.16),paint)

def undercarriage(drivers,small,paint,frame_length=8.8,frame_center=-.25):
    group('02 • Chassis')
    for y in [-.61,.61]:box('Main frame rail',(frame_center,y,1.08),(frame_length,.14,.30),'black')
    for x in [-3,-1,1,3]:box('Cross member',(x,0,1.02),(.16,1.4,.18),'black')
    group('03 • Wheels and axles')
    for i,(x,r) in enumerate(drivers+small):
        z=r+.18;cyl(f'Axle {i+1}',(x,0,z),.075,2.05,'steel','Y')
        for side in [-1,1]:wheel(x,side*.92,z,r,paint,f'Wheel {i+1:02} {"L" if side<0 else "R"}')
    group('04 • Valve gear')
    for side in [-1,1]:
        y=side*1.08
        for x,r in drivers:
            z=r+.18
            box('Axle bearing',(x,side*.62,z),(.32,.2,.35),'black')
            for layer in range(4):box('Laminated leaf spring',(x,side*.64,1.43+layer*.037),(1.0-layer*.12,.12,.025),'steel',.006)
            cyl('Crank pin',(x+.20,y,z-.24),.085,.10,'steel','Y')
        xa,ra=drivers[0]; xb,rb=drivers[-1]
        rod('Coupling rod',(xa+.20,y,ra-.06),(xb+.20,y,rb-.06),.057,'steel')
        for x,r in drivers: ring('Rod bearing',(x+.20,y+side*.055,r-.06),.07,.018,'brass')
        cyl('Steam cylinder',(-3.0,side*.73,.93),.25,.84,'black','X')
        for xx in [-3.43,-2.57]:cyl('Cylinder end cover',(xx,side*.73,.93),.27,.065,'steel','X')
        rod('Piston slide',(-2.58,side*.78,.93),(-1.0,side*.78,.93),.043,'steel')
        rod('Main connecting rod',(-1.80,side*1.15,.91),(drivers[1][0]+.20,side*1.15,drivers[1][1]-.06),.055,'steel')
        rod('Valve eccentric link',(-2.3,side*1.13,1.23),(.2,side*1.13,1.31),.027,'steel')
        rod('Valve rocker',(-1.2,side*1.13,.91),(-1.4,side*1.13,1.50),.038,'steel')

def tender(start,paint,trim,modern=False):
    group('07 • Tender body')
    L=CONFIG.get('tender_length',4.2 if modern else 3.5);c=start+L/2
    box('Tender underframe',(c,0,.93),(L,1.9,.25),'black')
    box('Tender tank',(c,0,1.63),(L-.15,1.83,1.16),paint,.13 if modern else .04)
    for y in [-.93,.93]:
        box('Coal bunker side',(c-.25,y,2.39),(L-.8,.09,.43),paint)
        box('Tender trim',(c,y*1.01,1.20),(L-.15,.025,.04),trim,.008)
        text('Railway lettering',' '.join(CONFIG.get('tender_lettering','NORTH STAR' if not modern else 'COMMODORE')),(c,y*1.02,1.78),.16,trim,1 if y>0 else -1)
        rivets_line('Tank bottom rivet',(start+.15,y*1.015,1.14),(start+L-.15,y*1.015,1.14),24,trim,.017)
        for xx in [start+.12,start+L-.12]:rivets_line('Tank seam',(xx,y*1.01,1.24),(xx,y*1.01,2.13),8,trim,.017)
    box('Bunker front',(start+.16,0,2.4),(.12,1.9,.4),paint)
    box('Bunker rear',(start+L-.65,0,2.4),(.12,1.9,.4),paint)
    cyl('Water filler',(start+L-.36,0,2.27),.23,.10,trim)
    for i in range(85):
        ball(f'Coal lump {i:03}',(random.uniform(start+.3,start+L-.8),random.uniform(-.76,.76),random.uniform(2.17,2.37)),(.15,.13,.11),'coal')
    for side in [-1,1]:
        for zz in [1.1,1.4,1.7,2.0]:rod('Tender ladder rung',(start+L+.015,side*.72,zz),(start+L+.015,side*.40,zz),.025,trim)
        for yy in [.4,.72]:rod('Tender ladder upright',(start+L,side*yy,1),(start+L,side*yy,2.2),.022,trim)
    group('08 • Tender bogies')
    for i,x in enumerate([start+.65,start+1.25,start+L-1.25,start+L-.65]):
        cyl('Tender axle',(x,0,.63),.06,1.9,'steel','Y')
        for side in [-1,1]:wheel(x,side*.87,.63,.45,'black',f'Tender {i+1} {side}')
    for side in [-1,1]:
        for x in [start+.95,start+L-.95]:
            box('Bogie frame',(x,side*.97,.70),(1.25,.1,.16),'black')
            box('Bogie spring',(x,side*.99,.89),(.5,.14,.12),'steel')
    group('09 • Couplers')
    box('Engine drawbar',(start-.3,0,.92),(.7,.15,.12),'steel')
    for x in [start-.3,start+L+.28]:
        box('Coupler shank',(x,0,.89),(.50,.17,.16),'black')
        ring('Coupling eye',(x+.15,0,.89),.12,.034,'steel','Z')

def vintage():
    scene=setup(); undercarriage(CONFIG['drivers'],CONFIG['small_wheels'],'red',CONFIG['frame_length'],CONFIG['frame_center'])
    group('01 • Boiler and smokebox')
    cyl('Boiler barrel',(-.65,0,2.03),.77,4.7,'green','X',64)
    cyl('Smokebox',(-3.14,0,2.03),.80,.55,'black','X',64)
    cyl('Smokebox door',(-3.44,0,2.03),.66,.08,'black','X',64)
    ring('Door brass rim',(-3.50,0,2.03),.64,.024,'brass','X')
    cyl('Front number medallion',(-3.51,0,2.03),.15,.04,'brass','X')
    for a in range(0,360,30):
        t=math.radians(a);ball('Door fastener',(-3.51,.58*math.sin(t),2.03+.58*math.cos(t)),(.035,.035,.035),'steel')
    for x in [-2.62,-1.35,.25,1.54]:
        ring('Boiler band',(x,0,2.03),.783,.029,'brass','X')
    for x in [-2.84,1.61]:
        for j in range(36):
            a=j*math.tau/36;ball('Boiler seam rivet',(x,.777*math.sin(a),2.03+.777*math.cos(a)),(.026,.026,.026),'brass')
    cyl('Stack base',(-2.8,0,2.85),.25,.26,'black')
    cyl('Chimney stem',(-2.8,0,3.18),.21,.6,'black')
    cyl('Flared spark arrestor',(-2.8,0,3.64),.23,.45,'black',r2=.46)
    cyl('Arrestor crown',(-2.8,0,3.94),.46,.16,'black',r2=.34)
    ring('Chimney brass lip',(-2.8,0,4.03),.34,.025,'brass','Z')
    cyl('Stack dark opening',(-2.8,0,4.022),.30,.01,'coal')
    for x in CONFIG.get('dome_positions',[-1.22,.70]):
        cyl('Dome pedestal',(x,0,2.81),.34,.19,'brass')
        cyl('Steam dome',(x,0,3.02),.30,.33,'green')
        ball('Dome cap',(x,0,3.20),(.31,.31,.16),'brass')
        cyl('Dome finial',(x,0,3.37),.055,.13,'brass')
    group('05 • Cab and controls')
    box('Cab floor',(2.35,0,1.36),(1.85,2.08,.17),'wood')
    for side in [-1,1]:
        y=side*1.01
        box('Cab lower side',(2.4,y,1.99),(1.72,.10,1.05),'green')
        box('Cab inset panel',(2.4,y*1.058,1.99),(1.35,.025,.65),'black')
        for z in [1.68,2.3]:box('Panel gold lining',(2.4,y*1.08,z),(1.39,.025,.025),'brass',.005)
        for x in [1.55,2.45,3.24]:box('Cab window pillar',(x,y,2.89),(.10,.14,1.0),'green')
        for z in [2.46,3.34]:box('Window sill',(2.4,y,z),(1.83,.17,.09),'brass')
        for x in [1.98,2.83]:box('Glazed window',(x,y*.985,2.91),(.67,.035,.71),'glass',.01)
        text('Cab number',CONFIG.get('cab_number','07'),(2.4,y*1.1,2),.30,'brass',side)
        for z in [.59,.89,1.19]:box('Cab access step',(3.04,side*1.08,z),(.48,.44,.065),'black')
        rod('Cab grab rail',(3.25,side*1.16,1.43),(3.25,side*1.16,2.54),.027,'brass')
    # front wall divided around two windows
    box('Cab front lower',(1.51,0,2.13),(.12,1.96,.8),'green')
    for y in [-.83,0,.83]:box('Front window frame',(1.51,y,2.96),(.12,.15,.8),'green')
    for y in [-.43,.43]:box('Front glazing',(1.52,y,2.96),(.035,.63,.65),'glass')
    box('Cab rear transom',(3.24,0,3.28),(.12,2,.19),'green')
    # curved roof, open underside
    verts=[];faces=[]
    for x in [1.34,3.46]:
        for i in range(21):
            y=-1.18+i*2.36/20;verts.append((x,y,3.43+.18*(1-(y/1.18)**2)))
    for i in range(20):faces.append((i,i+1,22+i,21+i))
    mesh=bpy.data.meshes.new('Arched cab roof');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Arched cab roof',mesh);CURRENT.objects.link(o);mesh.materials.append(M['black'])
    mod=o.modifiers.new('Roof thickness','SOLIDIFY');mod.thickness=.07
    box('Firebox',(1.82,0,1.97),(.40,1.10,1.05),'black')
    for y in [-.28,.28]:
        cyl('Pressure gauge',(2.05,y,2.57),.11,.06,'brass','X')
        cyl('Gauge face',(2.09,y,2.57),.092,.014,'cream','X')
    ring('Regulator handwheel',(2.15,0,2.12),.15,.023,'red','X')
    box('Driver seat',(2.87,-.51,1.93),(.41,.41,.10),'wood')
    group('06 • Fittings and pilot')
    for side in [-1,1]:
        y=side*.96
        box('Running board',(-.73,y,1.38),(5.5,.40,.09),'black')
        pipe('Boiler handrail',[(-3.18,side*.81,2.30),(-2.9,side*.87,2.52),(1.48,side*.87,2.52)],.024,'brass')
        for x in [-2.8,-1.8,-.8,.2,1.2]:rod('Handrail stanchion',(x,side*.69,2.51),(x,side*.87,2.52),.021,'brass')
        pipe('Steam delivery pipe',[(.72,side*.22,3.02),(.72,side*.80,2.77),(.72,side*.87,1.80),(-2.8,side*.87,1.80),(-2.8,side*.73,1.15)],.046,'brass')
    # pilot fan spreads toward track
    for i in range(13):
        y=-1.12+i*2.24/12;rod('Cowcatcher slat',(-3.61,y*.77,1.13),(-4.40,y,.31),.045,'red')
    rod('Pilot lower beam',(-4.40,-1.16,.31),(-4.40,1.16,.31),.065,'black')
    box('Front buffer beam',(-3.62,0,1.13),(.24,2.20,.23),'red')
    cyl('Headlamp housing',(-3.22,0,3.02),.24,.38,'brass','X')
    cyl('Headlamp lens',(-3.43,0,3.02),.20,.024,'lamp','X')
    cyl('Bell',(-.20,0,2.98),.14,.21,'brass',r2=.075)
    rod('Bell cradle',(-.4,0,2.86),(-.4,0,3.26),.025,'brass')
    rod('Bell cradle',(.0,0,2.86),(.0,0,3.26),.025,'brass')
    rod('Bell yoke',(-.4,0,3.26),(0,0,3.26),.025,'brass')
    tender(3.75,'green','brass')
    return scene

def shell_mesh(name,sections,m):
    # Elliptical upper casing. Longitudinal sections make the nose rounded in both axes.
    v=[]; f=[];N=40
    for x,w,zbase,h in sections:
        for i in range(N+1):
            t=math.pi*i/N;v.append((x,w*math.cos(t),zbase+h*math.sin(t)))
    for j in range(len(sections)-1):
        for i in range(N):
            a=j*(N+1)+i;f.append((a,a+1,a+N+2,a+N+1))
    f.append(tuple(range(N,-1,-1)));f.append(tuple((len(sections)-1)*(N+1)+i for i in range(N+1)))
    me=bpy.data.meshes.new(name);me.from_pydata(v,[],f);me.update()
    o=bpy.data.objects.new(name,me);CURRENT.objects.link(o);me.materials.append(M[m])
    for p in me.polygons:p.use_smooth=len(p.vertices)==4
    mod=o.modifiers.new('Casing thickness','SOLIDIFY');mod.thickness=.045
    return o

def streamlined():
    scene=setup();undercarriage(CONFIG['drivers'],CONFIG['small_wheels'],'black',CONFIG['frame_length'],CONFIG['frame_center'])
    group('01 • Streamlined casing')
    shell_mesh('Rounded wind-tunnel nose and casing',[(-4.65,.05,1.52,.16),(-4.56,.30,1.50,.80),(-4.35,.61,1.50,1.35),(-4.02,.86,1.50,1.65),(-3.50,1.01,1.50,1.78),(-2.8,1.06,1.5,1.8),(-1.5,1.06,1.5,1.8),(0,1.06,1.5,1.8),(1.5,1.06,1.5,1.8),(2.8,1.06,1.5,1.8),(3.12,1.02,1.5,1.76)],'navy')
    # Separate side valances with a broad curved opening above the driving wheels.
    for side in [-1,1]:
        xs=[-4.50,-4.15,-3.60,-3.,-2.5,-2,-1.5,-1,-.5,0,.5,1,1.5,2,2.5,3.1]
        bottom=[.64,.76,.9,1.05,1.26,1.48,1.62,1.72,1.78,1.81,1.81,1.77,1.68,1.53,1.32,1.15]
        vs=[]
        for x,z in zip(xs,bottom):
            width=min(1.085,.08+(x+4.5)*.70)
            top=min(2.49,1.56+(x+4.5)*1.12)
            vs.extend([(x,side*width,z),(x,side*width,top)])
        fs=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(xs)-1)]
        if side<0:fs=[tuple(reversed(f)) for f in fs]
        me=bpy.data.meshes.new('Swept valance');me.from_pydata(vs,[],fs);me.update()
        o=bpy.data.objects.new('Port valance' if side<0 else 'Starboard valance',me);CURRENT.objects.link(o);me.materials.append(M['navy'])
        so=o.modifiers.new('Sheet metal','SOLIDIFY');so.thickness=.045
        be=o.modifiers.new('Rolled edges','BEVEL');be.width=.025;be.segments=3
        pipe('Valance silver edge',[(x,side*(min(1.085,.08+(x+4.5)*.70)+.012),z+.018) for x,z in zip(xs,bottom)],.025,'steel')
        for z in [2.37,2.46]:pipe('Streamline pinstripe',[(-4.35,side*.40,z),(-3.7,side*.86,z),(-3.15,side*1.09,z),(3.1,side*1.10,z)],.018,'steel')
        text('Casing title',' '.join(CONFIG.get('body_lettering','COMMODORE VANDERBILT')),(-.3,side*1.102,2.12),.132,'steel',side)
        for x in [-2.70,-1.30,.10,1.50,2.85]:
            rivets_line('Casing seam',(x,side*1.091,1.87),(x,side*1.091,2.31),5,'steel',.013)
        for i in range(22):box('Cooling louver',(-2.15+i*.17,side*.923,2.72),(.073,.024,.23),'black',.012)
    ball('Rounded lower nose fairing',(-3.95,0,1.23),(.78,.83,.63),'navy')
    # silver dorsal blade follows the full nose curvature
    pipe('Dorsal silver spine',[(-4.67,0,1.68),(-4.57,0,2.30),(-4.35,0,2.85),(-4.02,0,3.15),(-3.5,0,3.29),(-2.8,0,3.31),(2.9,0,3.31)],.033,'steel')
    cyl('Recessed exhaust',(-2.78,0,3.32),.20,.07,'black')
    ring('Exhaust rolled lip',(-2.78,0,3.36),.20,.025,'steel','Z')
    group('05 • Cab and controls')
    box('Cab body',(3.52,0,1.94),(1.23,2.03,.83),'navy',.05)
    for side in [-1,1]:
        for x in [2.97,3.53,4.10]:box('Cab window pillar',(x,side*1.025,2.72),(.085,.1,.81),'navy')
        for x in [3.25,3.82]:box('Cab glass',(x,side*1.026,2.75),(.46,.025,.62),'glass',.025)
        for z in [2.36,3.11]:box('Window silver sill',(3.54,side*1.046,z),(1.18,.045,.045),'steel')
        box('Cab lower pinstripe',(3.54,side*1.038,1.49),(1.15,.026,.035),'steel')
        text('Engine number',CONFIG.get('cab_number','5344'),(3.52,side*1.05,1.99),.21,'steel',side)
        for z in [.6,.9,1.2]:box('Cab stair',(4.11,side*1.04,z),(.40,.38,.06),'black')
        rod('Cab handrail',(4.16,side*1.11,1.40),(4.16,side*1.11,2.56),.023,'steel')
    shell_mesh('Cab arched roof',[(2.9,1.11,3.10,.20),(4.25,1.11,3.1,.20)],'navy')
    box('Cab rear wall',(4.14,0,2.45),(.10,2.03,1.55),'navy')
    box('Cab rear door',(4.20,0,2.17),(.045,.60,1.26),'black')
    group('06 • Fittings and pilot')
    cyl('Nose headlight bezel',(-4.68,0,1.94),.20,.14,'steel','X')
    cyl('Nose headlight lens',(-4.765,0,1.94),.16,.02,'lamp','X')
    box('Front pilot',(-4.4,0,.63),(.47,1.85,.31),'navy',.13)
    for i in range(9):box('Pilot ventilation slot',(-4.65,-.64+i*.16,.63),(.028,.05,.19),'black',.018)
    for side in [-1,1]:
        cyl('Marker lamp',(-3.94,side*.82,2.44),.072,.11,'steel','X')
        cyl('Marker lens',(-4.01,side*.82,2.44),.05,.015,'lamp','X')
    tender(4.66,'navy','steel',True)
    return scene

def camera(name,location,target,scale):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o)
    o.location=location;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=scale;bpy.context.scene.camera=o
    return o

def light(name,p,power,size,color,target=(1,0,0)):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.location=p;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def stage(length,title,subtitle):
    group('90 • Display track')
    center=(length-4.8)/2
    box('Floating exhibit plinth',(center,0,-.24),(length+4.8,3.7,.40),'black',.14)
    for x in [i*.45-4.8 for i in range(int((length+4.8)/.45)+1)]:
        box('Oak sleeper',(x,0,.01),(.20,2.64,.16),'wood',.02)
        for side in [-1,1]:
            box('Rail chair',(x,side*.92,.105),(.26,.22,.025),'steel',.004)
    for side in [-1,1]:
        box('Rail head',(center,side*.92,.16),(length+4.8,.075,.075),'steel',.015)
        box('Rail web',(center,side*.92,.10),(length+4.8,.035,.12),'steel',.005)
    group('91 • Gallery')
    box('Gallery floor',(1,0,-.55),(200,200,.20),'floor',.0)
    camera('Hero camera',(-11,-17,10),(1.5,0,1.35),17.0)
    light('Warm key',(-3,-7,10),2300,8,(1,.84,.65))
    light('Cool rim',(4,5,8),2700,7,(.61,.79,1))
    light('Front softbox',(-8,1,5),1200,6,(.85,.95,1))
    light('Tender fill',(8,-4,6),1400,6,(1,.94,.79))

def export_and_render(slug,title,subtitle,build):
    scene=build()
    asset_collections=[c for n,c in GROUPS.items() if int(n[:2])<90]
    objects=[o for c in asset_collections for o in c.objects]
    for o in objects:
        o['assembly']=o.users_collection[0].name;o['model']=title
    out=ROOT/'models'/slug;out.mkdir(parents=True,exist_ok=True)
    def export_glb(path,objs):
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True)
    export_glb(out/(slug+'.glb'),objects)
    for c in asset_collections:
        safe=c.name.split(' • ')[1].lower().replace(' ','-')
        export_glb(out/(safe+'.glb'),list(c.objects))
    manifest={'title':title,'source':'https://x.com/tomkrcha/status/2095756085890310311','interpretation':'Original reference-inspired design, not a dimensionally exact replica.','object_count':len(objects),'assemblies':{c.name:len(c.objects) for c in asset_collections}}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    stage(9.3 if slug=='commodore' else 7.7,title,subtitle)
    bpy.ops.object.select_all(action='DESELECT')
    # Second scene duplicates editable objects but preserves the assembled model.
    exploded=bpy.data.scenes.new('02 • Exploded assemblies');exploded.world=scene.world
    for o in scene.objects:
        if o.type in ['CAMERA','LIGHT'] or any(c.name.startswith('91') for c in o.users_collection):exploded.collection.objects.link(o)
    offsets={'01':(0,0,3.8),'02':(0,0,1.5),'03':(0,-2.0,0),'04':(0,-3.7,1),'05':(0,1.5,3.2),'06':(-1.2,-1,2),'07':(1.1,0,2.5),'08':(1.1,-2,0),'09':(1.1,0,1.0)}
    for c in asset_collections:
        ec=bpy.data.collections.new(c.name+' • exploded');exploded.collection.children.link(ec)
        for original in c.objects:
            o=original.copy();ec.objects.link(o);o.location+=Vector(offsets[c.name[:2]])
    exploded.camera=scene.camera.copy();exploded.camera.data=scene.camera.data.copy();exploded.collection.objects.link(exploded.camera)
    exploded.camera.location=(-12,-21,14);exploded.camera.rotation_euler=(Vector((1.5,0,3))-exploded.camera.location).to_track_quat('-Z','Y').to_euler();exploded.camera.data.ortho_scale=20
    exploded.render.engine='CYCLES';exploded.cycles.samples=8;exploded.cycles.use_denoising=True
    exploded.render.resolution_x=1200;exploded.render.resolution_y=750;exploded.render.resolution_percentage=100
    exploded.view_settings.view_transform='AgX'
    # Save a useful starting viewport in solid material colors.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                area.spaces.active.region_3d.view_distance=18
                area.spaces.active.region_3d.view_location=(1.5,0,1.5)
    scene['README']='Two scenes: assembled model and exploded assemblies. Collections 01–09 are editable train parts; 90–91 are display only.'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(slug+'.blend')))
    if not RENDER:
        print('TRAIN_COMPLETE',slug,len(objects),flush=True);return
    scene.render.filepath=str(ROOT/'previews'/(slug+'.png'))
    bpy.ops.render.render(write_still=True,scene=scene.name)
    exploded.render.filepath=str(ROOT/'previews'/(slug+'-exploded.png'))
    bpy.ops.render.render(write_still=True,scene=exploded.name)
    print('TRAIN_COMPLETE',slug,len(objects),flush=True)

if __name__=='__main__':
    import sys, argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('models',nargs='*',help='heritage, commodore, or both when omitted')
    parser.add_argument('--template',type=Path,help='Custom JSON template; builder must be heritage or commodore')
    parser.add_argument('--output',type=Path,default=SOURCE_ROOT,help='Output root for models and previews')
    parser.add_argument('--no-render',action='store_true',help='Export editable assets without PNG renders')
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    args=parser.parse_args(argv)
    ROOT=args.output.resolve();RENDER=not args.no_render
    (ROOT/'models').mkdir(parents=True,exist_ok=True);(ROOT/'previews').mkdir(parents=True,exist_ok=True)
    builders={'heritage':vintage,'commodore':streamlined}
    targets=[args.template] if args.template else [SOURCE_ROOT/'templates'/(slug+'.json') for slug in (args.models or builders)]
    for template in targets:
        CONFIG=json.loads(template.read_text())
        slug=CONFIG['builder']
        if slug not in builders:parser.error('Template builder must be heritage or commodore')
        if len(CONFIG['drivers'])<2:parser.error('At least two driver axles are required for the valve gear')
        if not CONFIG['small_wheels'] or any(r<=0 for _,r in CONFIG['drivers']+CONFIG['small_wheels']):parser.error('Wheel radii must be positive and small_wheels must not be empty')
        export_and_render(slug,CONFIG['title'],CONFIG.get('subtitle',''),builders[slug])
