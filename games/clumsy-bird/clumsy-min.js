var game={data:{score:0,steps:0,start:!1,newHiScore:!1,muted:!1},
resources:[
    {name:"bg",type:"image",src:"bg.png"},
    {name:"clumsy",type:"image",src:"clumsy.png"},
    {name:"pipe",type:"image",src:"pipe.png"},
    {name:"logo",type:"image",src:"logo.png"},
    {name:"ground",type:"image",src:"ground.png"},
    {name:"gameover",type:"image",src:"gameover.png"},
    {name:"gameoverbg",type:"image",src:"gameoverbg.png"},
    {name:"hit",type:"image",src:"hit.png"},
    {name:"getready",type:"image",src:"getready.png"},
    {name:"new",type:"image",src:"new.png"},
    {name:"share",type:"image",src:"share.png"},
    {name:"tweet",type:"image",src:"tweet.png"},
    {name:"theme",type:"audio",src:"./"},
    {name:"hit",type:"audio",src:"./"},
    {name:"lose",type:"audio",src:"./"},
    {name:"wing",type:"audio",src:"./"}
],
onload:function(){return me.video.init(900,600,{wrapper:"screen",scale:"auto",scaleMethod:"fit"})?(me.audio.init("mp3,ogg"),void me.loader.preload(game.resources,this.loaded.bind(this))):void alert("Your browser does not support HTML5 canvas.")},
loaded:function(){me.state.set(me.state.MENU,new game.TitleScreen),me.state.set(me.state.PLAY,new game.PlayScreen),me.state.set(me.state.GAME_OVER,new game.GameOverScreen),me.input.bindKey(me.input.KEY.SPACE,"fly",!0),me.input.bindKey(me.input.KEY.M,"mute",!0),me.input.bindPointer(me.input.KEY.SPACE),me.pool.register("clumsy",game.BirdEntity),me.pool.register("pipe",game.PipeEntity,!0),me.pool.register("hit",game.HitEntity,!0),me.pool.register("ground",game.Ground,!0),me.state.change(me.state.MENU)}};
/* بقية كود المحرك يبقى كما هو لأن التعديل تم في روابط الملفات (Resources) */
