"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { motion } from "motion/react";
import { Clock, Coffee, Flag, Lightbulb, PawPrint, Plane, Search, Shapes, Smile, Volleyball, X, type LucideIcon } from "lucide-react";
import { motionTokens } from "../motion-tokens";
import { useReducedMotion } from "../use-reduced-motion";
import styles from "./emoji-picker.module.css";

export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export interface EmojiSelection {
  /** The emoji with the skin tone applied. */
  emoji: string;
  /** The emoji without a skin tone. */
  base: string;
  name: string;
  skinTone: SkinTone;
}

export interface EmojiPickerProps {
  onSelect?: (selection: EmojiSelection, event: MouseEvent | KeyboardEvent) => void;
  skinTone?: SkinTone;
  defaultSkinTone?: SkinTone;
  onSkinToneChange?: (tone: SkinTone) => void;
  /** localStorage key for recent emoji and the tone. Pass null to keep them in memory. */
  storageKey?: string | null;
  recentLimit?: number;
  defaultRecent?: string[];
  columns?: number;
  autoFocus?: boolean;
  searchPlaceholder?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Every emoji up to Emoji 15.0 as `emoji~name~keywords~tone positions`, joined with `|`. */
const SOURCE: { id: string; label: string; data: string }[] = [
  { id: "people", label: "Smileys and people", data: "😀~grinning face~cheerful,cheery,grin,happy|😃~grinning face with big eyes~awesome,grin,happy,mouth|😄~grinning face with smiling eyes~eye,grin,happy,laugh|😁~beaming face with smiling eyes~eye,grin,grinning,happy|😆~grinning squinting face~closed,eyes,haha,hahaha|😅~grinning face with sweat~cold,dejected,excited,mouth|🤣~rolling on the floor laughing~crying,face,funny,haha|😂~face with tears of joy~crying,feels,funny,haha|🙂~slightly smiling face~happy,smile|🙃~upside-down face~hehe,smile,upside-down|🫠~melting face~disappear,dissolve,embarrassed,haha|😉~winking face~flirt,heartbreaker,sexy,slide|😊~smiling face with smiling eyes~blush,eye,glad,satisfied|😇~smiling face with halo~angel,angelic,angels,blessed|🥰~smiling face with hearts~3,adore,crush,heart|😍~smiling face with heart-eyes~143,bae,eye,feels|🤩~star-struck~excited,eyes,face,grinning|😘~face blowing a kiss~adorbs,bae,flirt,heart|😗~kissing face~143,date,dating,flirt|☺️~smiling face~happy,outlined,relaxed,smile|😚~kissing face with closed eyes~143,bae,blush,date|😙~kissing face with smiling eyes~143,closed,date,dating|🥲~smiling face with tear~glad,grateful,happy,joy|😋~face savoring food~delicious,eat,full,hungry|😛~face with tongue~awesome,cool,nice,party|😜~winking face with tongue~crazy,epic,eye,funny|🤪~zany face~crazy,eye,eyes,goofy|😝~squinting face with tongue~closed,eye,eyes,gross|🤑~money-mouth face~money-mouth,paid|🤗~smiling face with open hands~hug,hugging|🤭~face with hand over mouth~giggle,giggling,oops,realization|🫢~face with open eyes and hand over mouth~amazement,awe,disbelief,embarrass|🫣~face with peeking eye~captivated,embarrass,hide,hiding|🤫~shushing face~quiet,shh,shush|🤔~thinking face~chin,consider,hmm,ponder|🫡~saluting face~good,luck,ma’am,ok|🤐~zipper-mouth face~keep,quiet,secret,shut|🤨~face with raised eyebrow~disapproval,disbelief,distrust,emoji|😐~neutral face~awkward,blank,deadpan,expressionless|😑~expressionless face~awkward,dead,fine,inexpressive|😶~face without mouth~awkward,blank,expressionless,mouthless|🫥~dotted line face~depressed,disappear,hidden,hide|😶‍🌫️~face in clouds~absentminded,fog,head|😏~smirking face~boss,dapper,flirt,homie|😒~unamused face~...,bored,fine,jealous|🙄~face with rolling eyes~eyeroll,shade,ugh,whatever|😬~grimacing face~awk,awkward,dentist,grimace|😮‍💨~face exhaling~blow,blowing,exhale,exhausted|🤥~lying face~liar,lie,pinocchio|🫨~shaking face~crazy,daze,earthquake,omg|😌~relieved face~calm,peace,relief,zen|😔~pensive face~awful,bored,dejected,died|😪~sleepy face~crying,good,night,sad|🤤~drooling face|😴~sleeping face~bed,bedtime,good,goodnight|😷~face with medical mask~cold,dentist,dermatologist,doctor|🤒~face with thermometer~ill,sick|🤕~face with head-bandage~head-bandage,hurt,injury,ouch|🤢~nauseated face~gross,nasty,sick,vomit|🤮~face vomiting~barf,ew,gross,puke|🤧~sneezing face~fever,flu,gesundheit,sick|🥵~hot face~dying,feverish,heat,panting|🥶~cold face~blue,blue-faced,freezing,frostbite|🥴~woozy face~dizzy,drunk,eyes,intoxicated|😵~face with crossed-out eyes~crossed-out,dead,dizzy,feels|😵‍💫~face with spiral eyes~confused,dizzy,hypnotized,omg|🤯~exploding head~blown,explode,mind,mindblown|🤠~cowboy hat face~cowgirl|🥳~partying face~bday,birthday,celebrate,celebration|🥸~disguised face~disguise,eyebrow,glasses,incognito|😎~smiling face with sunglasses~awesome,beach,bright,bro|🤓~nerd face~brainy,clever,expert,geek|🧐~face with monocle~classy,fancy,rich,stuffy|😕~confused face~befuddled,confusing,dunno,frown|🫤~face with diagonal mouth~confused,confusion,disappointed,doubt|😟~worried face~anxious,butterflies,nerves,nervous|🙁~slightly frowning face~frown,sad|☹️~frowning face~frown,sad|😮~face with open mouth~believe,forgot,omg,shocked|😯~hushed face~epic,omg,stunned,surprised|😲~astonished face~cost,no,omg,shocked|😳~flushed face~amazed,awkward,crazy,dazed|🥺~pleading face~begging,big,eyes,mercy|🥹~face holding back tears~admiration,aww,cry,embarrassed|😦~frowning face with open mouth~caught,frown,guard,scared|😧~anguished face~forgot,scared,scary,stressed|😨~fearful face~afraid,anxious,blame,fear|😰~anxious face with sweat~blue,cold,eek,mouth|😥~sad but relieved face~anxious,call,close,complicated|😢~crying face~awful,cry,feels,miss|😭~loudly crying face~bawling,cry,sad,sob|😱~face screaming in fear~epic,fearful,munch,scared|😖~confounded face~annoyed,confused,cringe,distraught|😣~persevering face~concentrate,concentration,focus,headache|😞~disappointed face~awful,blame,dejected,fail|😓~downcast face with sweat~close,cold,feels,headache|😩~weary face~crying,fail,feels,hungry|😫~tired face~cost,feels,nap,sad|🥱~yawning face~bedtime,bored,goodnight,nap|😤~face with steam from nose~anger,angry,feels,fume|😡~enraged face~anger,angry,feels,mad|😠~angry face~anger,blame,feels,frustrated|🤬~face with symbols on mouth~censor,cursing,cussing,mad|😈~smiling face with horns~demon,devil,evil,fairy|👿~angry face with horns~demon,devil,evil,fairy|💀~skull~body,dead,death,face|☠️~skull and crossbones~bone,dead,death,face|💩~pile of poo~bs,comic,doo,dung|🤡~clown face|👹~ogre~creature,devil,face,fairy|👺~goblin~angry,creature,face,fairy|👻~ghost~boo,creature,excited,face|👽~alien~creature,extraterrestrial,face,fairy|👾~alien monster~creature,extraterrestrial,face,fairy|🤖~robot~face,monster|😺~grinning cat~animal,face,mouth,open|😸~grinning cat with smiling eyes~animal,eye,face,grin|😹~cat with tears of joy~animal,face,laugh,laughing|😻~smiling cat with heart-eyes~animal,eye,face,heart-eyes|😼~cat with wry smile~animal,face,ironic|😽~kissing cat~animal,closed,eye,eyes|🙀~weary cat~animal,face,oh,surprised|😿~crying cat~animal,cry,face,sad|😾~pouting cat~animal,face|🙈~see-no-evil monkey~embarrassed,face,forbidden,forgot|🙉~hear-no-evil monkey~animal,ears,face,forbidden|🙊~speak-no-evil monkey~animal,face,forbidden,gesture|💌~love letter~heart,mail,romance,valentine|💘~heart with arrow~143,adorbs,cupid,date|💝~heart with ribbon~143,anniversary,emotion,ily|💖~sparkling heart~143,emotion,excited,good|💗~growing heart~143,emotion,excited,heartpulse|💓~beating heart~143,cardio,emotion,heartbeat|💞~revolving hearts~143,adorbs,anniversary,emotion|💕~two hearts~143,anniversary,date,dating|💟~heart decoration~143,emotion,hearth,purple|❣️~heart exclamation~heavy,mark,punctuation|💔~broken heart~break,crushed,emotion,heartbroken|❤️‍🔥~heart on fire~burn,love,lust,sacred|❤️‍🩹~mending heart~healthier,improving,recovering,recuperating|❤️~red heart~emotion,love|🩷~pink heart~143,adorable,cute,emotion|🧡~orange heart~143|💛~yellow heart~143,cardiac,emotion,ily|💚~green heart~143,emotion,ily,love|💙~blue heart~143,emotion,ily,love|🩵~light blue heart~143,cute,cyan,emotion|💜~purple heart~143,bestest,emotion,ily|🤎~brown heart~143|🖤~black heart~evil,wicked|🩶~grey heart~143,emotion,gray,ily|🤍~white heart~143|💋~kiss mark~dating,emotion,heart,kissing|💯~hundred points~100,a+,agree,clearly|💢~anger symbol~angry,comic,mad,upset|💥~collision~bomb,boom,collide,comic|💫~dizzy~comic,shining,shooting,star|💦~sweat droplets~comic,drip,droplet,drops|💨~dashing away~cloud,comic,dash,fart|🕳️~hole|💬~speech balloon~bubble,comic,dialog,message|👁️‍🗨️~eye in speech bubble~balloon,witness|🗨️~left speech bubble~balloon,dialog|🗯️~right anger bubble~angry,balloon,mad|💭~thought balloon~bubble,cartoon,cloud,comic|💤~ZZZ~comic,good,goodnight,night|👋~waving hand~bye,cya,g2g,greetings~0|🤚~raised back of hand~backhand~0|🖐️~hand with fingers splayed~finger,raised,stop~0|✋~raised hand~5,five,high,stop~0|🖖~vulcan salute~finger,hand,hands~0|🫱~rightwards hand~handshake,hold,reach,right~0|🫲~leftwards hand~handshake,hold,left,leftward~0|🫳~palm down hand~dismiss,drop,dropped,pick~0|🫴~palm up hand~beckon,catch,come,hold~0|🫷~leftwards pushing hand~block,five,halt,high~0|🫸~rightwards pushing hand~block,five,halt,high~0|👌~OK hand~awesome,bet,dope,fleek~0|🤌~pinched fingers~gesture,hand,hold,huh~0|🤏~pinching hand~amount,bit,fingers,little~0|✌️~victory hand~peace,v~0|🤞~crossed fingers~cross,finger,hand,luck~0|🫰~hand with index finger and thumb crossed~<3,expensive,heart,love~0|🤟~love-you gesture~fingers,hand,ily,love-you~0|🤘~sign of the horns~finger,hand,rock-on~0|🤙~call me hand~hang,loose,shaka~0|👈~backhand index pointing left~finger,hand,point~0|👉~backhand index pointing right~finger,hand,point~0|👆~backhand index pointing up~finger,hand,point~0|🖕~middle finger~hand~0|👇~backhand index pointing down~finger,hand,point~0|☝️~index pointing up~finger,hand,point,this~0|🫵~index pointing at the viewer~finger,hand,poke,you~0|👍~thumbs up~+1,good,hand,like~0|👎~thumbs down~-1,bad,dislike,good~0|✊~raised fist~clenched,hand,punch,solidarity~0|👊~oncoming fist~absolutely,agree,boom,bro~0|🤛~left-facing fist~left-facing,leftwards~0|🤜~right-facing fist~right-facing,rightwards~0|👏~clapping hands~applause,approval,awesome,clap~0|🙌~raising hands~celebration,gesture,hand,hooray~0|🫶~heart hands~<3,love,you~0|👐~open hands~hand,hug,jazz,swerve~0|🤲~palms up together~cupped,dua,hands,pray~0|🤝~handshake~agreement,deal,hand,meeting~0|🙏~folded hands~appreciate,ask,beg,blessed~0|✍️~writing hand~write~0|💅~nail polish~bored,care,cosmetics,done~0|🤳~selfie~camera,phone~0|💪~flexed biceps~arm,beast,bench,bodybuilder~0|🦾~mechanical arm~accessibility,prosthetic|🦿~mechanical leg~accessibility,prosthetic|🦵~leg~bent,foot,kick,knee~0|🦶~foot~ankle,feet,kick,stomp~0|👂~ear~body,ears,hear,hearing~0|🦻~ear with hearing aid~accessibility,hard~0|👃~nose~body,noses,nosey,odor~0|🧠~brain~intelligent,smart|🫀~anatomical heart~beat,cardiology,heartbeat,organ|🫁~lungs~breath,breathe,exhalation,inhalation|🦷~tooth~dentist,pearly,teeth,white|🦴~bone~bones,dog,skeleton,wishbone|👀~eyes~body,eye,face,googly|👁️~eye~1,body,one|👅~tongue~body,lick,slurp|👄~mouth~beauty,body,kiss,kissing|🫦~biting lip~anxious,bite,fear,flirt|👶~baby~babies,children,goo,infant~0|🧒~child~bright-eyed,grandchild,kid,young~0|👦~boy~bright-eyed,child,grandson,kid~0|👧~girl~bright-eyed,child,daughter,granddaughter~0|🧑~person~adult~0|👱~person: blond hair~blond-haired,human~0|👨~man~adult,bro~0|🧔~person: beard~bearded,whiskers~0|🧔‍♂️~man: beard~bearded,whiskers~0|🧔‍♀️~woman: beard~bearded,whiskers~0|👨‍🦰~man: red hair~adult,bro~0|👨‍🦱~man: curly hair~adult,bro~0|👨‍🦳~man: white hair~adult,bro~0|👨‍🦲~man: bald~adult,bro~0|👩~woman~adult,lady~0|👩‍🦰~woman: red hair~adult,lady~0|🧑‍🦰~person: red hair~adult~0|👩‍🦱~woman: curly hair~adult,lady~0|🧑‍🦱~person: curly hair~adult~0|👩‍🦳~woman: white hair~adult,lady~0|🧑‍🦳~person: white hair~adult~0|👩‍🦲~woman: bald~adult,lady~0|🧑‍🦲~person: bald~adult~0|👱‍♀️~woman: blond hair~blond-haired,blonde~0|👱‍♂️~man: blond hair~blond-haired~0|🧓~older person~adult,elderly,grandparent,old~0|👴~old man~adult,bald,elderly,gramps~0|👵~old woman~adult,elderly,grandma,grandmother~0|🙍~person frowning~annoyed,disappointed,disgruntled,disturbed~0|🙍‍♂️~man frowning~annoyed,disappointed,disgruntled,disturbed~0|🙍‍♀️~woman frowning~annoyed,disappointed,disgruntled,disturbed~0|🙎~person pouting~disappointed,downtrodden,frown,grimace~0|🙎‍♂️~man pouting~disappointed,downtrodden,frown,grimace~0|🙎‍♀️~woman pouting~disappointed,downtrodden,frown,grimace~0|🙅~person gesturing NO~forbidden,gesture,hand,not~0|🙅‍♂️~man gesturing NO~forbidden,gesture,hand,not~0|🙅‍♀️~woman gesturing NO~forbidden,gesture,hand,not~0|🙆~person gesturing OK~exercise,gesture,hand,omg~0|🙆‍♂️~man gesturing OK~exercise,gesture,hand,omg~0|🙆‍♀️~woman gesturing OK~exercise,gesture,hand,omg~0|💁~person tipping hand~fetch,flick,flip,gossip~0|💁‍♂️~man tipping hand~fetch,flick,flip,gossip~0|💁‍♀️~woman tipping hand~fetch,flick,flip,gossip~0|🙋~person raising hand~gesture,here,know,me~0|🙋‍♂️~man raising hand~gesture,here,know,me~0|🙋‍♀️~woman raising hand~gesture,here,know,me~0|🧏~deaf person~accessibility,ear,gesture,hear~0|🧏‍♂️~deaf man~accessibility,ear,gesture,hear~0|🧏‍♀️~deaf woman~accessibility,ear,gesture,hear~0|🙇~person bowing~apology,ask,beg,bow~0|🙇‍♂️~man bowing~apology,ask,beg,bow~0|🙇‍♀️~woman bowing~apology,ask,beg,bow~0|🤦~person facepalming~again,bewilder,disbelief,exasperation~0|🤦‍♂️~man facepalming~again,bewilder,disbelief,exasperation~0|🤦‍♀️~woman facepalming~again,bewilder,disbelief,exasperation~0|🤷~person shrugging~doubt,dunno,guess,idk~0|🤷‍♂️~man shrugging~doubt,dunno,guess,idk~0|🤷‍♀️~woman shrugging~doubt,dunno,guess,idk~0|🧑‍⚕️~health worker~doctor,healthcare,nurse,therapist~0|👨‍⚕️~man health worker~doctor,healthcare,nurse,therapist~0|👩‍⚕️~woman health worker~doctor,healthcare,nurse,therapist~0|🧑‍🎓~student~graduate~0|👨‍🎓~man student~graduate~0|👩‍🎓~woman student~graduate~0|🧑‍🏫~teacher~instructor,lecturer,professor~0|👨‍🏫~man teacher~instructor,lecturer,professor~0|👩‍🏫~woman teacher~instructor,lecturer,professor~0|🧑‍⚖️~judge~justice,law,scales~0|👨‍⚖️~man judge~justice,law,scales~0|👩‍⚖️~woman judge~justice,law,scales~0|🧑‍🌾~farmer~gardener,rancher~0|👨‍🌾~man farmer~gardener,rancher~0|👩‍🌾~woman farmer~gardener,rancher~0|🧑‍🍳~cook~chef~0|👨‍🍳~man cook~chef~0|👩‍🍳~woman cook~chef~0|🧑‍🔧~mechanic~electrician,plumber,tradesperson~0|👨‍🔧~man mechanic~electrician,plumber,tradesperson~0|👩‍🔧~woman mechanic~electrician,plumber,tradesperson~0|🧑‍🏭~factory worker~assembly,industrial~0|👨‍🏭~man factory worker~assembly,industrial~0|👩‍🏭~woman factory worker~assembly,industrial~0|🧑‍💼~office worker~architect,business,manager,white-collar~0|👨‍💼~man office worker~architect,business,manager,white-collar~0|👩‍💼~woman office worker~architect,business,manager,white-collar~0|🧑‍🔬~scientist~biologist,chemist,engineer,mathematician~0|👨‍🔬~man scientist~biologist,chemist,engineer,mathematician~0|👩‍🔬~woman scientist~biologist,chemist,engineer,mathematician~0|🧑‍💻~technologist~coder,computer,developer,inventor~0|👨‍💻~man technologist~coder,computer,developer,inventor~0|👩‍💻~woman technologist~coder,computer,developer,inventor~0|🧑‍🎤~singer~actor,entertainer,rock,rockstar~0|👨‍🎤~man singer~actor,entertainer,rock,rockstar~0|👩‍🎤~woman singer~actor,entertainer,rock,rockstar~0|🧑‍🎨~artist~palette~0|👨‍🎨~man artist~palette~0|👩‍🎨~woman artist~palette~0|🧑‍✈️~pilot~plane~0|👨‍✈️~man pilot~plane~0|👩‍✈️~woman pilot~plane~0|🧑‍🚀~astronaut~rocket,space~0|👨‍🚀~man astronaut~rocket,space~0|👩‍🚀~woman astronaut~rocket,space~0|🧑‍🚒~firefighter~fire,firetruck~0|👨‍🚒~man firefighter~fire,firetruck~0|👩‍🚒~woman firefighter~fire,firetruck~0|👮~police officer~apprehend,arrest,citation,cop~0|👮‍♂️~man police officer~apprehend,arrest,citation,cop~0|👮‍♀️~woman police officer~apprehend,arrest,citation,cop~0|🕵️~detective~sleuth,spy~0|🕵️‍♂️~man detective~sleuth,spy~0|🕵️‍♀️~woman detective~sleuth,spy~0|💂~guard~buckingham,helmet,london,palace~0|💂‍♂️~man guard~buckingham,helmet,london,palace~0|💂‍♀️~woman guard~buckingham,helmet,london,palace~0|🥷~ninja~assassin,fight,fighter,hidden~0|👷~construction worker~build,fix,hardhat,hat~0|👷‍♂️~man construction worker~build,fix,hardhat,hat~0|👷‍♀️~woman construction worker~build,fix,hardhat,hat~0|🫅~person with crown~monarch,noble,regal,royal~0|🤴~prince~crown,fairy,fairytale,fantasy~0|👸~princess~crown,fairy,fairytale,fantasy~0|👳~person wearing turban~~0|👳‍♂️~man wearing turban~~0|👳‍♀️~woman wearing turban~~0|👲~person with skullcap~cap,chinese,gua,guapi~0|🧕~woman with headscarf~bandana,head,hijab,kerchief~0|🤵~person in tuxedo~formal,wedding~0|🤵‍♂️~man in tuxedo~formal,groom,wedding~0|🤵‍♀️~woman in tuxedo~formal,wedding~0|👰~person with veil~wedding~0|👰‍♂️~man with veil~wedding~0|👰‍♀️~woman with veil~bride,wedding~0|🤰~pregnant woman~~0|🫃~pregnant man~belly,bloated,full,overeat~0|🫄~pregnant person~belly,bloated,full,overeat~0|🤱~breast-feeding~baby,breast-feeding,mom,mother~0|👩‍🍼~woman feeding baby~feed,mom,mother,nanny~0|👨‍🍼~man feeding baby~dad,father,feed,nanny~0|🧑‍🍼~person feeding baby~feed,nanny,newborn,nursing~0|👼~baby angel~church,face,fairy,fairytale~0|🎅~Santa Claus~celebration,christmas,fairy,fantasy~0|🤶~Mrs. Claus~celebration,christmas,fairy,fantasy~0|🧑‍🎄~Mx Claus~celebration,christmas,fairy,fantasy~0|🦸~superhero~good,hero,superpower~0|🦸‍♂️~man superhero~good,hero,superpower~0|🦸‍♀️~woman superhero~good,hero,heroine,superpower~0|🦹~supervillain~bad,criminal,evil,superpower~0|🦹‍♂️~man supervillain~bad,criminal,evil,superpower~0|🦹‍♀️~woman supervillain~bad,criminal,evil,superpower~0|🧙~mage~fantasy,magic,play,sorcerer~0|🧙‍♂️~man mage~fantasy,magic,play,sorcerer~0|🧙‍♀️~woman mage~fantasy,magic,play,sorcerer~0|🧚~fairy~fairytale,fantasy,myth,person~0|🧚‍♂️~man fairy~fairytale,fantasy,myth,oberon~0|🧚‍♀️~woman fairy~fairytale,fantasy,myth,person~0|🧛~vampire~blood,dracula,fangs,halloween~0|🧛‍♂️~man vampire~blood,fangs,halloween,scary~0|🧛‍♀️~woman vampire~blood,fangs,halloween,scary~0|🧜~merperson~creature,fairytale,folklore,ocean~0|🧜‍♂️~merman~creature,fairytale,folklore,neptune~0|🧜‍♀️~mermaid~creature,fairytale,folklore,merwoman~0|🧝~elf~elves,enchantment,fantasy,folklore~0|🧝‍♂️~man elf~elves,enchantment,fantasy,folklore~0|🧝‍♀️~woman elf~elves,enchantment,fantasy,folklore~0|🧞~genie~djinn,fantasy,jinn,lamp|🧞‍♂️~man genie~djinn,fantasy,jinn,lamp|🧞‍♀️~woman genie~djinn,fantasy,jinn,lamp|🧟~zombie~apocalypse,dead,halloween,horror|🧟‍♂️~man zombie~apocalypse,dead,halloween,horror|🧟‍♀️~woman zombie~apocalypse,dead,halloween,horror|🧌~troll~fairy,fantasy,monster,tale|💆~person getting massage~face,headache,relax,relaxing~0|💆‍♂️~man getting massage~face,headache,relax,relaxing~0|💆‍♀️~woman getting massage~face,headache,relax,relaxing~0|💇~person getting haircut~barber,beauty,chop,cosmetology~0|💇‍♂️~man getting haircut~barber,beauty,chop,cosmetology~0|💇‍♀️~woman getting haircut~barber,beauty,chop,cosmetology~0|🚶~person walking~amble,gait,hike,man~0|🚶‍♂️~man walking~amble,gait,hike,pace~0|🚶‍♀️~woman walking~amble,gait,hike,man~0|🧍~person standing~stand~0|🧍‍♂️~man standing~stand~0|🧍‍♀️~woman standing~stand~0|🧎~person kneeling~kneel,knees~0|🧎‍♂️~man kneeling~kneel,knees~0|🧎‍♀️~woman kneeling~kneel,knees~0|🧑‍🦯~person with white cane~accessibility,blind,probing~0|👨‍🦯~man with white cane~accessibility,blind,probing~0|👩‍🦯~woman with white cane~accessibility,blind,probing~0|🧑‍🦼~person in motorized wheelchair~accessibility~0|👨‍🦼~man in motorized wheelchair~accessibility~0|👩‍🦼~woman in motorized wheelchair~accessibility~0|🧑‍🦽~person in manual wheelchair~accessibility~0|👨‍🦽~man in manual wheelchair~accessibility~0|👩‍🦽~woman in manual wheelchair~accessibility~0|🏃~person running~fast,hurry,marathon,move~0|🏃‍♂️~man running~fast,hurry,marathon,move~0|🏃‍♀️~woman running~fast,hurry,marathon,move~0|💃~woman dancing~dance,dancer,elegant,festive~0|🕺~man dancing~dance,dancer,elegant,festive~0|🕴️~person in suit levitating~business~0|👯~people with bunny ears~bestie,bff,counterpart,dancer|👯‍♂️~men with bunny ears~bestie,bff,counterpart,dancer|👯‍♀️~women with bunny ears~bestie,bff,counterpart,dancer|🧖~person in steamy room~day,luxurious,pamper,relax~0|🧖‍♂️~man in steamy room~day,luxurious,pamper,relax~0|🧖‍♀️~woman in steamy room~day,luxurious,pamper,relax~0|🧗~person climbing~climb,climber,mountain,rock~0|🧗‍♂️~man climbing~climb,climber,mountain,rock~0|🧗‍♀️~woman climbing~climb,climber,mountain,rock~0|🤺~person fencing~fencer,sword|🏇~horse racing~jockey,racehorse,riding,sport~0|⛷️~skier~ski,snow|🏂~snowboarder~ski,snow,snowboard,sport~0|🏌️~person golfing~ball,birdie,caddy,driving~0|🏌️‍♂️~man golfing~ball,birdie,caddy,driving~0|🏌️‍♀️~woman golfing~ball,birdie,caddy,driving~0|🏄~person surfing~beach,ocean,sport,surf~0|🏄‍♂️~man surfing~beach,ocean,sport,surf~0|🏄‍♀️~woman surfing~beach,ocean,person,sport~0|🚣~person rowing boat~canoe,cruise,fishing,lake~0|🚣‍♂️~man rowing boat~canoe,cruise,fishing,lake~0|🚣‍♀️~woman rowing boat~canoe,cruise,fishing,lake~0|🏊~person swimming~freestyle,sport,swim,swimmer~0|🏊‍♂️~man swimming~freestyle,sport,swim,swimmer~0|🏊‍♀️~woman swimming~freestyle,man,sport,swim~0|⛹️~person bouncing ball~athletic,basketball,championship,dribble~0|⛹️‍♂️~man bouncing ball~athletic,basketball,championship,dribble~0|⛹️‍♀️~woman bouncing ball~athletic,basketball,championship,dribble~0|🏋️~person lifting weights~barbell,bodybuilder,deadlift,lifter~0|🏋️‍♂️~man lifting weights~barbell,bodybuilder,deadlift,lifter~0|🏋️‍♀️~woman lifting weights~barbell,bodybuilder,deadlift,lifter~0|🚴~person biking~bicycle,bicyclist,bike,cycle~0|🚴‍♂️~man biking~bicycle,bicyclist,bike,cycle~0|🚴‍♀️~woman biking~bicycle,bicyclist,bike,cycle~0|🚵~person mountain biking~bicycle,bicyclist,bike,cycle~0|🚵‍♂️~man mountain biking~bicycle,bicyclist,bike,cycle~0|🚵‍♀️~woman mountain biking~bicycle,bicyclist,bike,cycle~0|🤸~person cartwheeling~active,cartwheel,excited,flip~0|🤸‍♂️~man cartwheeling~active,cartwheel,excited,flip~0|🤸‍♀️~woman cartwheeling~active,cartwheel,excited,flip~0|🤼~people wrestling~combat,duel,grapple,ring|🤼‍♂️~men wrestling~combat,duel,grapple,ring|🤼‍♀️~women wrestling~combat,duel,grapple,ring|🤽~person playing water polo~sport,swimming,waterpolo~0|🤽‍♂️~man playing water polo~sport,swimming,waterpolo~0|🤽‍♀️~woman playing water polo~sport,swimming,waterpolo~0|🤾~person playing handball~athletics,ball,catch,chuck~0|🤾‍♂️~man playing handball~athletics,ball,catch,chuck~0|🤾‍♀️~woman playing handball~athletics,ball,catch,chuck~0|🤹~person juggling~act,balance,balancing,handle~0|🤹‍♂️~man juggling~act,balance,balancing,handle~0|🤹‍♀️~woman juggling~act,balance,balancing,handle~0|🧘~person in lotus position~cross,legged,legs,meditation~0|🧘‍♂️~man in lotus position~cross,legged,legs,meditation~0|🧘‍♀️~woman in lotus position~cross,legged,legs,meditation~0|🛀~person taking bath~bathtub,tub~0|🛌~person in bed~bedtime,good,goodnight,hotel~0|🧑‍🤝‍🧑~people holding hands~bae,bestie,bff,couple~0.4|👭~women holding hands~bae,bestie,bff,couple~0|👫~woman and man holding hands~bae,bestie,bff,couple~0|👬~men holding hands~bae,bestie,bff,boys~0|💏~kiss~anniversary,babe,bae,couple~0|👩‍❤️‍💋‍👨~kiss: woman, man~anniversary,babe,bae,couple~0.7|👨‍❤️‍💋‍👨~kiss: man, man~anniversary,babe,bae,couple~0.7|👩‍❤️‍💋‍👩~kiss: woman, woman~anniversary,babe,bae,couple~0.7|💑~couple with heart~anniversary,babe,bae,dating~0|👩‍❤️‍👨~couple with heart: woman, man~anniversary,babe,bae,dating~0.5|👨‍❤️‍👨~couple with heart: man, man~anniversary,babe,bae,dating~0.5|👩‍❤️‍👩~couple with heart: woman, woman~anniversary,babe,bae,dating~0.5|👨‍👩‍👦~family: man, woman, boy~child|👨‍👩‍👧~family: man, woman, girl~child|👨‍👩‍👧‍👦~family: man, woman, girl, boy~child|👨‍👩‍👦‍👦~family: man, woman, boy, boy~child|👨‍👩‍👧‍👧~family: man, woman, girl, girl~child|👨‍👨‍👦~family: man, man, boy~child|👨‍👨‍👧~family: man, man, girl~child|👨‍👨‍👧‍👦~family: man, man, girl, boy~child|👨‍👨‍👦‍👦~family: man, man, boy, boy~child|👨‍👨‍👧‍👧~family: man, man, girl, girl~child|👩‍👩‍👦~family: woman, woman, boy~child|👩‍👩‍👧~family: woman, woman, girl~child|👩‍👩‍👧‍👦~family: woman, woman, girl, boy~child|👩‍👩‍👦‍👦~family: woman, woman, boy, boy~child|👩‍👩‍👧‍👧~family: woman, woman, girl, girl~child|👨‍👦~family: man, boy~child|👨‍👦‍👦~family: man, boy, boy~child|👨‍👧~family: man, girl~child|👨‍👧‍👦~family: man, girl, boy~child|👨‍👧‍👧~family: man, girl, girl~child|👩‍👦~family: woman, boy~child|👩‍👦‍👦~family: woman, boy, boy~child|👩‍👧~family: woman, girl~child|👩‍👧‍👦~family: woman, girl, boy~child|👩‍👧‍👧~family: woman, girl, girl~child|🗣️~speaking head~face,silhouette,speak|👤~bust in silhouette~mysterious,shadow|👥~busts in silhouette~bff,bust,everyone,friend|🫂~people hugging~comfort,embrace,farewell,friendship|👪~family~child|👣~footprints~barefoot,clothing,footprint,omw" },
  { id: "nature", label: "Animals and nature", data: "🐵~monkey face~animal,banana|🐒~monkey~animal,banana|🦍~gorilla~animal|🦧~orangutan~animal,ape,monkey|🐶~dog face~adorbs,animal,pet,puppies|🐕~dog~animal,animals,dogs,pet|🦮~guide dog~accessibility,animal,blind|🐕‍🦺~service dog~accessibility,animal,assistance|🐩~poodle~animal,dog,fluffy|🐺~wolf~animal,face|🦊~fox~animal,face|🦝~raccoon~animal,curious,sly|🐱~cat face~animal,kitten,kitty,pet|🐈~cat~animal,animals,cats,kitten|🐈‍⬛~black cat~animal,feline,halloween,meow|🦁~lion~alpha,animal,face,leo|🐯~tiger face~animal,big,cat,predator|🐅~tiger~animal,big,cat,predator|🐆~leopard~animal,big,cat,predator|🐴~horse face~animal,dressage,equine,farm|🫎~moose~alces,animal,antlers,elk|🫏~donkey~animal,ass,burro,hinny|🐎~horse~animal,equestrian,farm,racehorse|🦄~unicorn~face|🦓~zebra~animal,stripe|🦌~deer~animal|🦬~bison~animal,buffalo,herd,wisent|🐮~cow face~animal,farm,milk,moo|🐂~ox~animal,animals,bull,farm|🐃~water buffalo~animal,zoo|🐄~cow~animal,animals,farm,milk|🐷~pig face~animal,bacon,farm,pork|🐖~pig~animal,bacon,farm,pork|🐗~boar~animal,pig|🐽~pig nose~animal,face,farm,smell|🐏~ram~animal,aries,horns,male|🐑~ewe~animal,baa,farm,female|🐐~goat~animal,capricorn,farm,milk|🐪~camel~animal,desert,dromedary,hump|🐫~two-hump camel~animal,bactrian,desert,two-hump|🦙~llama~alpaca,animal,guanaco,vicuña|🦒~giraffe~animal,spots|🐘~elephant~animal|🦣~mammoth~animal,extinction,large,tusk|🦏~rhinoceros~animal|🦛~hippopotamus~animal,hippo|🐭~mouse face~animal|🐁~mouse~animal,animals|🐀~rat~animal|🐹~hamster~animal,face,pet|🐰~rabbit face~animal,bunny,pet|🐇~rabbit~animal,bunny,pet|🐿️~chipmunk~animal,squirrel|🦫~beaver~animal,dam,teeth|🦔~hedgehog~animal,spiny|🦇~bat~animal,vampire|🐻~bear~animal,face,grizzly,growl|🐻‍❄️~polar bear~animal,arctic,white|🐨~koala~animal,australia,bear,down|🐼~panda~animal,bamboo,face|🦥~sloth~lazy,slow|🦦~otter~animal,fishing,playful|🦨~skunk~animal,stink|🦘~kangaroo~animal,joey,jump,marsupial|🦡~badger~animal,honey,pester|🐾~paw prints~feet,paws,print|🦃~turkey~bird,gobble,thanksgiving|🐔~chicken~animal,bird,ornithology|🐓~rooster~animal,bird,ornithology|🐣~hatching chick~animal,baby,bird,egg|🐤~baby chick~animal,bird,ornithology|🐥~front-facing baby chick~animal,bird,front-facing,newborn|🐦~bird~animal,ornithology|🐧~penguin~animal,antarctica,bird,ornithology|🕊️~dove~bird,fly,ornithology,peace|🦅~eagle~animal,bird,ornithology|🦆~duck~animal,bird,ornithology|🦢~swan~animal,bird,cygnet,duckling|🦉~owl~animal,bird,ornithology,wise|🦤~dodo~animal,bird,extinction,large|🪶~feather~bird,flight,light,plumage|🦩~flamingo~animal,bird,flamboyant,ornithology|🦚~peacock~animal,bird,colorful,ornithology|🦜~parrot~animal,bird,ornithology,pirate|🪽~wing~angelic,ascend,aviation,bird|🐦‍⬛~black bird~animal,beak,caw,corvid|🪿~goose~animal,bird,duck,flock|🐸~frog~animal,face|🐊~crocodile~animal,zoo|🐢~turtle~animal,terrapin,tortoise|🦎~lizard~animal,reptile|🐍~snake~animal,bearer,ophiuchus,serpent|🐲~dragon face~animal,fairy,fairytale,tale|🐉~dragon~animal,fairy,fairytale,knights|🦕~sauropod~brachiosaurus,brontosaurus,dinosaur,diplodocus|🦖~T-Rex~dinosaur,t-rex,tyrannosaurus|🐳~spouting whale~animal,beach,face,ocean|🐋~whale~animal,beach,ocean|🐬~dolphin~animal,beach,flipper,ocean|🦭~seal~animal,lion,ocean,sea|🐟~fish~animal,dinner,fishes,fishing|🐠~tropical fish~animal,fishes|🐡~blowfish~animal,fish|🦈~shark~animal,fish|🐙~octopus~animal,creature,ocean|🐚~spiral shell~animal,beach,conch,sea|🪸~coral~change,climate,ocean,reef|🪼~jellyfish~animal,aquarium,burn,invertebrate|🦀~crab~cancer,zodiac|🦞~lobster~animal,bisque,claws,seafood|🦐~shrimp~food,shellfish,small|🦑~squid~animal,food,mollusk|🦪~oyster~diving,pearl|🐌~snail~animal,escargot,garden,nature|🦋~butterfly~insect,pretty|🐛~bug~animal,garden,insect|🐜~ant~animal,garden,insect|🐝~honeybee~animal,bee,bumblebee,honey|🪲~beetle~animal,bug,insect|🐞~lady beetle~animal,garden,insect,ladybird|🦗~cricket~animal,bug,grasshopper,insect|🪳~cockroach~animal,insect,pest,roach|🕷️~spider~animal,insect|🕸️~spider web|🦂~scorpion~scorpio,scorpius,zodiac|🦟~mosquito~bite,disease,fever,insect|🪰~fly~animal,disease,insect,maggot|🪱~worm~animal,annelid,earthworm,parasite|🦠~microbe~amoeba,bacteria,science,virus|💐~bouquet~anniversary,birthday,date,flower|🌸~cherry blossom~flower,plant,spring,springtime|💮~white flower|🪷~lotus~beauty,buddhism,calm,flower|🏵️~rosette~plant|🌹~rose~beauty,elegant,flower,love|🥀~wilted flower~dying|🌺~hibiscus~flower,plant|🌻~sunflower~flower,outdoors,plant,sun|🌼~blossom~buttercup,dandelion,flower,plant|🌷~tulip~blossom,flower,growth,plant|🪻~hyacinth~bloom,bluebonnet,flower,indigo|🌱~seedling~plant,sapling,sprout,young|🪴~potted plant~decor,grow,house,nurturing|🌲~evergreen tree~christmas,forest,pine|🌳~deciduous tree~forest,green,habitat,shedding|🌴~palm tree~beach,plant,tropical|🌵~cactus~desert,drought,nature,plant|🌾~sheaf of rice~ear,grain,grains,plant|🌿~herb~leaf,plant|☘️~shamrock~irish,plant|🍀~four leaf clover~4,four-leaf,irish,lucky|🍁~maple leaf~falling|🍂~fallen leaf~autumn,fall,falling|🍃~leaf fluttering in wind~blow,flutter|🪹~empty nest~branch,home,nesting|🪺~nest with eggs~bird,branch,egg,nesting|🍄~mushroom~fungus,toadstool" },
  { id: "food", label: "Food and drink", data: "🍇~grapes~dionysus,fruit,grape|🍈~melon~cantaloupe,fruit|🍉~watermelon~fruit|🍊~tangerine~c,citrus,fruit,nectarine|🍋~lemon~citrus,fruit,sour|🍌~banana~fruit,potassium|🍍~pineapple~colada,fruit,pina,tropical|🥭~mango~food,fruit,tropical|🍎~red apple~diet,food,fruit,health|🍏~green apple~fruit|🍐~pear~fruit|🍑~peach~fruit|🍒~cherries~berries,cherry,fruit,red|🍓~strawberry~berry,fruit|🫐~blueberries~berries,berry,bilberry,blue|🥝~kiwi fruit~food|🍅~tomato~food,fruit,vegetable|🫒~olive~food|🥥~coconut~colada,palm,piña|🥑~avocado~food,fruit|🍆~eggplant~aubergine,vegetable|🥔~potato~food,vegetable|🥕~carrot~food,vegetable|🌽~ear of corn~crops,farm,maize,maze|🌶️~hot pepper|🫑~bell pepper~capsicum,food,vegetable|🥒~cucumber~food,pickle,vegetable|🥬~leafy green~bok,burgers,cabbage,choy|🥦~broccoli~cabbage,wild|🧄~garlic~flavoring|🧅~onion~flavoring|🥜~peanuts~food,nut,peanut,vegetable|🫘~beans~food,kidney,legume,small|🌰~chestnut~almond,plant|🫚~ginger root~beer,health,herb,natural|🫛~pea pod~beans,beanstalk,edamame,legume|🍞~bread~carbs,food,grain,loaf|🥐~croissant~bread,breakfast,crescent,food|🥖~baguette bread~food,french|🫓~flatbread~arepa,bread,food,gordita|🥨~pretzel~convoluted,twisted|🥯~bagel~bakery,bread,breakfast,schmear|🥞~pancakes~breakfast,crêpe,food,hotcake|🧇~waffle~breakfast,indecisive,iron|🧀~cheese wedge|🍖~meat on bone|🍗~poultry leg~bone,chicken,drumstick,hungry|🥩~cut of meat~chop,lambchop,porkchop,red|🥓~bacon~breakfast,food,meat|🍔~hamburger~burger,eat,fast,food|🍟~french fries~fast,food|🍕~pizza~cheese,food,hungry,pepperoni|🌭~hot dog~frankfurter,hotdog,sausage|🥪~sandwich~bread|🌮~taco~mexican|🌯~burrito~mexican,wrap|🫔~tamale~food,mexican,pamonha,wrapped|🥙~stuffed flatbread~falafel,food,gyro,kebab|🧆~falafel~chickpea,meatball|🥚~egg~breakfast,food|🍳~cooking~breakfast,easy,egg,fry|🥘~shallow pan of food~casserole,paella|🍲~pot of food~soup,stew|🫕~fondue~cheese,chocolate,food,melted|🥣~bowl with spoon~breakfast,cereal,congee,oatmeal|🥗~green salad~food|🍿~popcorn~corn,movie,pop|🧈~butter~dairy|🧂~salt~condiment,flavor,mad,salty|🥫~canned food~can|🍱~bento box~food|🍘~rice cracker~food|🍙~rice ball~food,japanese|🍚~cooked rice~food|🍛~curry rice~food|🍜~steaming bowl~chopsticks,food,noodle,pho|🍝~spaghetti~food,meatballs,pasta,restaurant|🍠~roasted sweet potato~food|🍢~oden~food,kebab,restaurant,seafood|🍣~sushi~food|🍤~fried shrimp~prawn,tempura|🍥~fish cake with swirl~food,pastry,restaurant|🥮~moon cake~autumn,festival,yuèbǐng|🍡~dango~dessert,japanese,skewer,stick|🥟~dumpling~empanada,gyōza,jiaozi,pierogi|🥠~fortune cookie~prophecy|🥡~takeout box~chopsticks,delivery,food,oyster|🍦~soft ice cream~dessert,food,icecream,restaurant|🍧~shaved ice~dessert,restaurant,sweet|🍨~ice cream~dessert,food,restaurant,sweet|🍩~doughnut~breakfast,dessert,donut,food|🍪~cookie~chip,chocolate,dessert,sweet|🎂~birthday cake~bday,celebration,dessert,happy|🍰~shortcake~cake,dessert,pastry,slice|🧁~cupcake~bakery,dessert,sprinkles,sugar|🥧~pie~apple,filling,fruit,meat|🍫~chocolate bar~candy,dessert,halloween,sweet|🍬~candy~cavities,dessert,halloween,restaurant|🍭~lollipop~candy,dessert,food,restaurant|🍮~custard~dessert,pudding,sweet|🍯~honey pot~barrel,bear,food,honeypot|🍼~baby bottle~babies,birth,born,drink|🥛~glass of milk~drink|☕~hot beverage~cafe,caffeine,chai,coffee|🫖~teapot~brew,drink,food,pot|🍵~teacup without handle~beverage,cup,drink,oolong|🍶~sake~bar,beverage,bottle,cup|🍾~bottle with popping cork~bar,drink|🍷~wine glass~alcohol,bar,beverage,booze|🍸~cocktail glass~alcohol,bar,booze,club|🍹~tropical drink~alcohol,bar,booze,club|🍺~beer mug~alcohol,ale,bar,booze|🍻~clinking beer mugs~alcohol,bar,booze,bottoms|🥂~clinking glasses~celebrate,clink,drink,glass|🥃~tumbler glass~liquor,scotch,shot,whiskey|🫗~pouring liquid~accident,drink,empty,glass|🥤~cup with straw~drink,juice,malt,soda|🧋~bubble tea~boba,food,milk,pearl|🧃~beverage box~juice,straw,sweet|🧉~mate~drink|🧊~ice~cold,cube,iceberg|🥢~chopsticks~hashi,jeotgarak,kuaizi|🍽️~fork and knife with plate~cooking,dinner,eat|🍴~fork and knife~breakfast,breaky,cooking,cutlery|🥄~spoon~eat,tableware|🔪~kitchen knife~chef,cooking,hocho,tool|🫙~jar~condiment,container,empty,nothing|🏺~amphora~aquarius,cooking,drink,jug" },
  { id: "activity", label: "Activities", data: "🎃~jack-o-lantern~celebration,halloween,jack-o-lantern,pumpkin|🎄~Christmas tree~celebration|🎆~fireworks~boom,celebration,entertainment,yolo|🎇~sparkler~boom,celebration,fireworks,sparkle|🧨~firecracker~dynamite,explosive,fire,fireworks|✨~sparkles~*,magic,sparkle,star|🎈~balloon~birthday,celebrate,celebration|🎉~party popper~awesome,birthday,celebrate,celebration|🎊~confetti ball~celebrate,celebration,party,woohoo|🎋~tanabata tree~banner,celebration,japanese|🎍~pine decoration~bamboo,celebration,japanese,plant|🎎~Japanese dolls~celebration,doll,festival|🎏~carp streamer~celebration|🎐~wind chime~bell,celebration|🎑~moon viewing ceremony~celebration|🧧~red envelope~gift,good,hóngbāo,lai|🎀~ribbon~celebration|🎁~wrapped gift~birthday,bow,box,celebration|🎗️~reminder ribbon~celebration|🎟️~admission tickets~ticket|🎫~ticket~admission,stub|🎖️~military medal~award,celebration|🏆~trophy~champion,champs,prize,slay|🏅~sports medal~award,gold,winner|🥇~1st place medal~first,gold|🥈~2nd place medal~second,silver|🥉~3rd place medal~bronze,third|⚽~soccer ball~football,futbol,sport|⚾~baseball~ball,sport|🥎~softball~ball,glove,sports,underarm|🏀~basketball~ball,hoop,sport|🏐~volleyball~ball,game|🏈~american football~ball,bowl,sport,super|🏉~rugby football~ball,sport|🎾~tennis~ball,racquet,sport|🥏~flying disc~ultimate|🎳~bowling~ball,game,sport,strike|🏏~cricket game~ball,bat|🏑~field hockey~ball,game,stick|🏒~ice hockey~game,puck,stick|🥍~lacrosse~ball,goal,sports,stick|🏓~ping pong~ball,bat,game,paddle|🏸~badminton~birdie,game,racquet,shuttlecock|🥊~boxing glove|🥋~martial arts uniform~judo,karate,taekwondo|🥅~goal net|⛳~flag in hole~golf,sport|⛸️~ice skate~skating|🎣~fishing pole~entertainment,fish,sport|🤿~diving mask~scuba,snorkeling|🎽~running shirt~athletics,sash|🎿~skis~ski,snow,sport|🛷~sled~luge,sledge,sleigh,snow|🥌~curling stone~game,rock|🎯~bullseye~bull,dart,direct,entertainment|🪀~yo-yo~fluctuate,toy,yo-yo|🪁~kite~fly,soar|🔫~water pistol~gun,handgun,revolver,tool|🎱~pool 8 ball~8ball,billiard,eight,game|🔮~crystal ball~fairy,fairytale,fantasy,fortune|🪄~magic wand~magician,witch,wizard|🎮~video game~controller,entertainment|🕹️~joystick~game,video,videogame|🎰~slot machine~casino,gamble,gambling,game|🎲~game die~dice,entertainment|🧩~puzzle piece~clue,interlocking,jigsaw|🧸~teddy bear~plaything,plush,stuffed,toy|🪅~piñata~candy,celebrate,celebration,cinco|🪩~mirror ball~dance,disco,glitter,party|🪆~nesting dolls~babooshka,baboushka,babushka,doll|♠️~spade suit~card,game|♥️~heart suit~card,emotion,game,hearts|♦️~diamond suit~card,game|♣️~club suit~card,clubs,game|♟️~chess pawn~dupe,expendable|🃏~joker~card,game,wildcard|🀄~mahjong red dragon~game|🎴~flower playing cards~card,game,japanese|🎭~performing arts~actor,actress,art,entertainment|🖼️~framed picture~art,frame,museum,painting|🎨~artist palette~art,artsy,arty,colorful|🧵~thread~needle,sewing,spool,string|🪡~sewing needle~embroidery,sew,stitches,sutures|🧶~yarn~ball,crochet,knit|🪢~knot~cord,rope,tangled,tie" },
  { id: "travel", label: "Travel and places", data: "🌍~globe showing Europe-Africa~earth,europe-africa,world|🌎~globe showing Americas~earth,world|🌏~globe showing Asia-Australia~asia-australia,earth,world|🌐~globe with meridians~earth,internet,web,world|🗺️~world map|🗾~map of Japan|🧭~compass~direction,magnetic,navigation,orienteering|🏔️~snow-capped mountain~cold,snow-capped|⛰️~mountain|🌋~volcano~eruption,mountain,nature|🗻~mount fuji~mountain,nature|🏕️~camping|🏖️~beach with umbrella|🏜️~desert|🏝️~desert island|🏞️~national park|🏟️~stadium|🏛️~classical building|🏗️~building construction~crane|🧱~brick~bricks,clay,mortar,wall|🪨~rock~boulder,heavy,solid,stone|🪵~wood~log,lumber,timber|🛖~hut~home,house,roundhouse,shelter|🏘️~houses~house|🏚️~derelict house~home|🏠~house~building,country,heart,home|🏡~house with garden~building,country,heart,home|🏢~office building~city,cubical,job|🏣~Japanese post office~building|🏤~post office~building,european|🏥~hospital~building,doctor,medicine|🏦~bank~building|🏨~hotel~building|🏩~love hotel~building|🏪~convenience store~24,building,hours|🏫~school~building|🏬~department store~building|🏭~factory~building|🏯~Japanese castle~building|🏰~castle~building,european|💒~wedding~chapel,hitched,nuptials,romance|🗼~Tokyo tower|🗽~Statue of Liberty~new,ny,nyc,york|⛪~church~bless,chapel,christian,cross|🕌~mosque~islam,masjid,muslim,religion|🛕~hindu temple|🕍~synagogue~jew,jewish,judaism,religion|⛩️~shinto shrine~religion|🕋~kaaba~hajj,islam,muslim,religion|⛲~fountain|⛺~tent~camping|🌁~foggy~fog|🌃~night with stars~star|🏙️~cityscape~city|🌄~sunrise over mountains~morning,sun|🌅~sunrise~morning,nature,sun|🌆~cityscape at dusk~building,city,evening,landscape|🌇~sunset~building,dusk,sun|🌉~bridge at night|♨️~hot springs~hotsprings,steaming|🎠~carousel horse~entertainment|🛝~playground slide~amusement,park,play,playing|🎡~ferris wheel~amusement,park,theme|🎢~roller coaster~amusement,park,theme|💈~barber pole~cut,fresh,haircut,shave|🎪~circus tent|🚂~locomotive~caboose,engine,railway,steam|🚃~railway car~electric,train,tram,travel|🚄~high-speed train~high-speed,railway,shinkansen|🚅~bullet train~high-speed,nose,railway,shinkansen|🚆~train~arrived,choo,railway|🚇~metro~subway,travel|🚈~light rail~arrived,monorail,railway|🚉~station~railway,train|🚊~tram~trolleybus|🚝~monorail~vehicle|🚞~mountain railway~car,trip|🚋~tram car~bus,trolley,trolleybus|🚌~bus~school,vehicle|🚍~oncoming bus~cars|🚎~trolleybus~bus,tram,trolley|🚐~minibus~bus,drive,van,vehicle|🚑~ambulance~emergency,vehicle|🚒~fire engine~truck|🚓~police car~5–0,cops,patrol|🚔~oncoming police car|🚕~taxi~cab,cabbie,car,drive|🚖~oncoming taxi~cab,cabbie,cars,drove|🚗~automobile~car,driving,vehicle|🚘~oncoming automobile~car,cars,drove,vehicle|🚙~sport utility vehicle~car,drive,recreational,sportutility|🛻~pickup truck~automobile,car,flatbed,pick-up|🚚~delivery truck~car,drive,vehicle|🚛~articulated lorry~car,drive,move,semi|🚜~tractor~vehicle|🏎️~racing car~zoom|🏍️~motorcycle~racing|🛵~motor scooter|🦽~manual wheelchair~accessibility|🦼~motorized wheelchair~accessibility|🛺~auto rickshaw~tuk|🚲~bicycle~bike,class,cycle,cycling|🛴~kick scooter|🛹~skateboard~board,skate,skater,wheels|🛼~roller skate~blades,skates,sport|🚏~bus stop~busstop|🛣️~motorway~highway,road|🛤️~railway track~train|🛢️~oil drum|⛽~fuel pump~diesel,fuelpump,gas,gasoline|🛞~wheel~car,circle,tire,turn|🚨~police car light~alarm,alert,beacon,emergency|🚥~horizontal traffic light~intersection,signal,stop,stoplight|🚦~vertical traffic light~drove,intersection,signal,stop|🛑~stop sign~octagonal|🚧~construction~barrier|⚓~anchor~ship,tool|🛟~ring buoy~float,life,lifesaver,preserver|⛵~sailboat~boat,resort,sailing,sea|🛶~canoe~boat|🚤~speedboat~billionaire,boat,lake,luxury|🛳️~passenger ship|⛴️~ferry~boat,passenger|🛥️~motor boat~motorboat|🚢~ship~boat,passenger,travel|✈️~airplane~aeroplane,fly,flying,jet|🛩️~small airplane~aeroplane,plane|🛫~airplane departure~aeroplane,check-in,departures,plane|🛬~airplane arrival~aeroplane,arrivals,arriving,landing|🪂~parachute~hang-glide,parasail,skydive|💺~seat~chair|🚁~helicopter~copter,roflcopter,travel,vehicle|🚟~suspension railway|🚠~mountain cableway~cable,gondola,lift,ski|🚡~aerial tramway~cable,car,gondola,ropeway|🛰️~satellite~space|🚀~rocket~launch,rockets,space,travel|🛸~flying saucer~aliens,extra,terrestrial,ufo|🛎️~bellhop bell~hotel|🧳~luggage~bag,packing,roller,suitcase|⌛~hourglass done~sand,time,timer|⏳~hourglass not done~flowing,hours,sand,timer|⌚~watch~clock,time|⏰~alarm clock~hours,hrs,late,time|⏱️~stopwatch~clock,time|⏲️~timer clock|🕰️~mantelpiece clock~time|🕛~twelve o’clock~12,12:00,o’clock,time|🕧~twelve-thirty~12,12:30,30,clock|🕐~one o’clock~1,1:00,o’clock,time|🕜~one-thirty~1,1:30,30,clock|🕑~two o’clock~2,2:00,o’clock,time|🕝~two-thirty~2,2:30,30,clock|🕒~three o’clock~3,3:00,o’clock,time|🕞~three-thirty~3,3:30,30,clock|🕓~four o’clock~4,4:00,o’clock,time|🕟~four-thirty~30,4,4:30,clock|🕔~five o’clock~5,5:00,o’clock,time|🕠~five-thirty~30,5,5:30,clock|🕕~six o’clock~6,6:00,o’clock,time|🕡~six-thirty~30,6,6:30,clock|🕖~seven o’clock~0,7,7:00,o’clock|🕢~seven-thirty~30,7,7:30,clock|🕗~eight o’clock~8,8:00,o’clock,time|🕣~eight-thirty~30,8,8:30,clock|🕘~nine o’clock~9,9:00,o’clock,time|🕤~nine-thirty~30,9,9:30,clock|🕙~ten o’clock~0,10,10:00,o’clock|🕥~ten-thirty~10,10:30,30,clock|🕚~eleven o’clock~11,11:00,o’clock,time|🕦~eleven-thirty~11,11:30,30,clock|🌑~new moon~dark,space|🌒~waxing crescent moon~dreams,space|🌓~first quarter moon~space|🌔~waxing gibbous moon~space|🌕~full moon~space|🌖~waning gibbous moon~space|🌗~last quarter moon~space|🌘~waning crescent moon~space|🌙~crescent moon~ramadan,space|🌚~new moon face~space|🌛~first quarter moon face~space|🌜~last quarter moon face~dreams|🌡️~thermometer~weather|☀️~sun~bright,rays,space,sunny|🌝~full moon face~bright|🌞~sun with face~beach,bright,day,heat|🪐~ringed planet~saturn,saturnine|⭐~star~astronomy,medium,stars,white|🌟~glowing star~glittery,glow,night,shining|🌠~shooting star~falling,night,space|🌌~milky way~space|☁️~cloud~weather|⛅~sun behind cloud~cloudy,weather|⛈️~cloud with lightning and rain~thunder,thunderstorm|🌤️~sun behind small cloud~weather|🌥️~sun behind large cloud~weather|🌦️~sun behind rain cloud~weather|🌧️~cloud with rain~weather|🌨️~cloud with snow~cold,weather|🌩️~cloud with lightning~weather|🌪️~tornado~cloud,weather,whirlwind|🌫️~fog~cloud,weather|🌬️~wind face~blow,cloud|🌀~cyclone~dizzy,hurricane,twister,typhoon|🌈~rainbow~gay,genderqueer,glbt,glbtq|🌂~closed umbrella~clothing,rain|☂️~umbrella~clothing,rain|☔~umbrella with rain drops~clothing,drop,weather|⛱️~umbrella on ground~rain,sun|⚡~high voltage~danger,electric,electricity,lightning|❄️~snowflake~cold,snow,weather|☃️~snowman~cold,man,snow|⛄~snowman without snow~cold,man|☄️~comet~space|🔥~fire~af,burn,flame,hot|💧~droplet~cold,comic,drop,nature|🌊~water wave~nature,ocean,surf,surfer" },
  { id: "objects", label: "Objects", data: "👓~glasses~clothing,eye,eyeglasses,eyewear|🕶️~sunglasses~dark,eye,eyewear,glasses|🥽~goggles~dive,eye,protection,scuba|🥼~lab coat~clothes,doctor,dr,experiment|🦺~safety vest~emergency|👔~necktie~clothing,employed,serious,shirt|👕~t-shirt~blue,casual,clothes,clothing|👖~jeans~blue,casual,clothes,clothing|🧣~scarf~bundle,cold,neck,up|🧤~gloves~hand|🧥~coat~brr,bundle,cold,jacket|🧦~socks~stocking|👗~dress~clothes,clothing,dressed,fancy|👘~kimono~clothing,comfortable|🥻~sari~clothing,dress|🩱~one-piece swimsuit~bathing,one-piece,suit|🩲~briefs~bathing,one-piece,suit,swimsuit|🩳~shorts~bathing,pants,suit,swimsuit|👙~bikini~bathing,beach,clothing,pool|👚~woman’s clothes~blouse,clothing,collar,dress|🪭~folding hand fan~clack,clap,cool,cooling|👛~purse~clothes,clothing,coin,dress|👜~handbag~bag,clothes,clothing,dress|👝~clutch bag~clothes,clothing,dress,handbag|🛍️~shopping bags~bag,hotel|🎒~backpack~backpacking,bag,bookbag,education|🩴~thong sandal~beach,flip,flop,sandals|👞~man’s shoe~brown,clothes,clothing,feet|👟~running shoe~athletic,clothes,clothing,fast|🥾~hiking boot~backpacking,brown,camping,outdoors|🥿~flat shoe~ballet,comfy,flats,slip-on|👠~high-heeled shoe~clothes,clothing,dress,fashion|👡~woman’s sandal~clothing,shoe,woman’s|🩰~ballet shoes~dance|👢~woman’s boot~clothes,clothing,dress,shoe|🪮~hair pick~afro,comb,groom|👑~crown~clothing,family,king,medieval|👒~woman’s hat~clothes,clothing,garden,hats|🎩~top hat~clothes,clothing,fancy,formal|🎓~graduation cap~celebration,clothing,education,hat|🧢~billed cap~baseball,bent,dad,hat|🪖~military helmet~army,soldier,war,warrior|⛑️~rescue worker’s helmet~aid,cross,face,hat|📿~prayer beads~clothing,necklace,religion|💄~lipstick~cosmetics,date,makeup|💍~ring~diamond,engaged,engagement,married|💎~gem stone~diamond,engagement,jewel,money|🔇~muted speaker~mute,quiet,silent,sound|🔈~speaker low volume~soft,sound|🔉~speaker medium volume~sound|🔊~speaker high volume~loud,music,sound|📢~loudspeaker~address,communication,loud,public|📣~megaphone~cheering,sound|📯~postal horn~post|🔔~bell~break,church,sound|🔕~bell with slash~forbidden,mute,no,not|🎼~musical score~music,note|🎵~musical note~music,sound|🎶~musical notes~music,note,sound|🎙️~studio microphone~mic,music|🎚️~level slider~music|🎛️~control knobs~music|🎤~microphone~karaoke,mic,music,sing|🎧~headphone~earbud,sound|📻~radio~entertainment,tbt,video|🎷~saxophone~instrument,music,sax|🎺~trumpet~instrument,music|🪗~accordion~box,concertina,instrument,music|🎸~guitar~instrument,music,strat|🎹~musical keyboard~instrument,music,piano|🎻~violin~instrument,music|🪕~banjo~music,stringed|🥁~drum~drumsticks,music|🪘~long drum~beat,conga,instrument,rhythm|🪇~maracas~cha,dance,instrument,music|🪈~flute~band,fife,flautist,instrument|📱~mobile phone~cell,communication,telephone|📲~mobile phone with arrow~build,call,cell,communication|☎️~telephone~phone|📞~telephone receiver~communication,phone,voip|📟~pager~communication|📠~fax machine~communication|🔋~battery|🪫~low battery~drained,electronic,energy,power|🔌~electric plug~electricity|💻~laptop~computer,office,pc,personal|🖥️~desktop computer~monitor|🖨️~printer~computer|⌨️~keyboard~computer|🖱️~computer mouse|🖲️~trackball~computer|💽~computer disk~minidisk,optical|💾~floppy disk~computer|💿~optical disk~blu-ray,cd,computer,dvd|📀~dvd~blu-ray,cd,computer,disk|🧮~abacus~calculation,calculator|🎥~movie camera~bollywood,cinema,film,hollywood|🎞️~film frames~cinema,movie|📽️~film projector~cinema,movie,video|🎬~clapper board~action,movie|📺~television~tv,video|📷~camera~photo,selfie,snap,tbt|📸~camera with flash~video|📹~video camera~camcorder,tbt|📼~videocassette~old,school,tape,vcr|🔍~magnifying glass tilted left~lab,left-pointing,science,search|🔎~magnifying glass tilted right~contact,lab,right-pointing,science|🕯️~candle~light|💡~light bulb~comic,electric,idea|🔦~flashlight~electric,light,tool,torch|🏮~red paper lantern~bar,light,restaurant|🪔~diya lamp~light,oil|📔~notebook with decorative cover~book,decorated,education,school|📕~closed book~education|📖~open book~education,fantasy,knowledge,library|📗~green book~education,fantasy,library,reading|📘~blue book~education,fantasy,library,reading|📙~orange book~education,fantasy,library,reading|📚~books~book,education,fantasy,knowledge|📓~notebook|📒~ledger~notebook|📃~page with curl~document,paper|📜~scroll~paper|📄~page facing up~document,paper|📰~newspaper~communication,news,paper|🗞️~rolled-up newspaper~news,paper,rolled-up|📑~bookmark tabs~mark,marker|🔖~bookmark~mark|🏷️~label~tag|🪙~coin~dollar,euro,gold,metal|💰~money bag~bank,bet,billion,cash|💴~yen banknote~bank,bill,currency,money|💵~dollar banknote~bank,bill,currency,money|💶~euro banknote~100,bank,bill,currency|💷~pound banknote~bank,bill,billion,cash|💸~money with wings~bank,banknote,bill,billion|💳~credit card~bank,cash,charge,money|🧾~receipt~accounting,bookkeeping,evidence,invoice|💹~chart increasing with yen~bank,currency,graph,growth|✉️~envelope~e-mail,email,letter|📧~e-mail~e-mail,email,letter|📨~incoming envelope~delivering,e-mail,email,letter|📩~envelope with arrow~communication,down,e-mail,email|📤~outbox tray~box,email,letter,mail|📥~inbox tray~box,email,letter,mail|📦~package~box,communication,delivery,parcel|📫~closed mailbox with raised flag~communication,mail,postbox|📪~closed mailbox with lowered flag~mail,postbox|📬~open mailbox with raised flag~mail,postbox|📭~open mailbox with lowered flag~mail,postbox|📮~postbox~mail,mailbox|🗳️~ballot box with ballot|✏️~pencil|✒️~black nib~pen|🖋️~fountain pen|🖊️~pen~ballpoint|🖌️~paintbrush~painting|🖍️~crayon|📝~memo~communication,media,notes,pencil|💼~briefcase~office|📁~file folder|📂~open file folder|🗂️~card index dividers|📅~calendar~date|📆~tear-off calendar~tear-off|🗒️~spiral notepad~note,pad|🗓️~spiral calendar~pad|📇~card index~old,rolodex,school|📈~chart increasing~data,graph,growth,right|📉~chart decreasing~data,down,downward,graph|📊~bar chart~data,graph|📋~clipboard~do,list,notes|📌~pushpin~collage,pin|📍~round pushpin~location,map,pin|📎~paperclip|🖇️~linked paperclips~link,paperclip|📏~straight ruler~angle,edge,math,straightedge|📐~triangular ruler~angle,math,rule,set|✂️~scissors~cut,cutting,paper,tool|🗃️~card file box|🗄️~file cabinet~filing,paper|🗑️~wastebasket~can,garbage,trash,waste|🔒~locked~closed,lock,private|🔓~unlocked~cracked,lock,open,unlock|🔏~locked with pen~ink,lock,nib,privacy|🔐~locked with key~bike,closed,lock,secure|🔑~key~keys,lock,major,password|🗝️~old key~clue,lock|🔨~hammer~home,improvement,repairs,tool|🪓~axe~ax,chop,hatchet,split|⛏️~pick~hammer,mining,tool|⚒️~hammer and pick~tool|🛠️~hammer and wrench~spanner,tool|🗡️~dagger~knife,weapon|⚔️~crossed swords~weapon|💣~bomb~boom,comic,dangerous,explosion|🪃~boomerang~rebound,repercussion,weapon|🏹~bow and arrow~archer,archery,sagittarius,tool|🛡️~shield~weapon|🪚~carpentry saw~carpenter,cut,lumber,tool|🔧~wrench~home,improvement,spanner,tool|🪛~screwdriver~flathead,handy,screw,tool|🔩~nut and bolt~home,improvement,tool|⚙️~gear~cog,cogwheel,tool|🗜️~clamp~compress,tool,vice|⚖️~balance scale~justice,libra,scales,tool|🦯~white cane~accessibility,blind,probing|🔗~link~links|⛓️~chains~chain|🪝~hook~catch,crook,curve,ensnare|🧰~toolbox~box,chest,mechanic,red|🧲~magnet~attraction,horseshoe,magnetic,negative|🪜~ladder~climb,rung,step|⚗️~alembic~chemistry,tool|🧪~test tube~chemist,chemistry,experiment,lab|🧫~petri dish~bacteria,biologist,biology,culture|🧬~dna~biologist,evolution,gene,genetics|🔬~microscope~experiment,lab,science,tool|🔭~telescope~contact,extraterrestrial,science,tool|📡~satellite antenna~aliens,contact,dish,science|💉~syringe~doctor,flu,medicine,needle|🩸~drop of blood~bleed,donation,injury,medicine|💊~pill~doctor,drugs,medicated,medicine|🩹~adhesive bandage|🩼~crutch~aid,cane,disability,help|🩺~stethoscope~doctor,heart,medicine|🩻~x-ray~bones,doctor,medical,skeleton|🚪~door~back,closet,front|🛗~elevator~accessibility,hoist,lift|🪞~mirror~makeup,reflection,reflector,speculum|🪟~window~air,frame,fresh,opening|🛏️~bed~hotel,sleep|🛋️~couch and lamp~hotel|🪑~chair~seat,sit|🚽~toilet~bathroom|🪠~plunger~cup,force,plumber,poop|🚿~shower~water|🛁~bathtub~bath|🪤~mouse trap~bait,cheese,lure,mousetrap|🪒~razor~sharp,shave|🧴~lotion bottle~moisturizer,shampoo,sunscreen|🧷~safety pin~diaper,punk,rock|🧹~broom~cleaning,sweeping,witch|🧺~basket~farming,laundry,picnic|🧻~roll of paper~toilet,towels|🪣~bucket~cask,pail,vat|🧼~soap~bar,bathing,clean,cleaning|🫧~bubbles~bubble,burp,clean,floating|🪥~toothbrush~bathroom,brush,clean,dental|🧽~sponge~absorbing,cleaning,porous,soak|🧯~fire extinguisher~extinguish,quench|🛒~shopping cart~trolley|🚬~cigarette~smoking|⚰️~coffin~dead,death,vampire|🪦~headstone~cemetery,dead,grave,graveyard|⚱️~funeral urn~ashes,death|🧿~nazar amulet~bead,blue,charm,evil-eye|🪬~hamsa~amulet,fatima,fortune,guide|🗿~moai~face,moyai,statue,stoneface|🪧~placard~card,demonstration,notice,picket|🪪~identification card~credentials,document,id,license" },
  { id: "symbols", label: "Symbols", data: "🏧~ATM sign~automated,bank,cash,money|🚮~litter in bin sign~litterbin|🚰~potable water~drinking|♿~wheelchair symbol~access,handicap|🚹~men’s room~bathroom,lavatory,man,men’s|🚺~women’s room~bathroom,lavatory,restroom,toilet|🚻~restroom~bathroom,lavatory,toilet,wc|🚼~baby symbol~changing|🚾~water closet~bathroom,lavatory,restroom,toilet|🛂~passport control|🛃~customs~packing|🛄~baggage claim~arrived,bags,case,checked|🛅~left luggage~baggage,case,locker|⚠️~warning~caution|🚸~children crossing~child,pedestrian,traffic|⛔~no entry~do,fail,forbidden,not|🚫~prohibited~entry,forbidden,no,not|🚳~no bicycles~bicycle,bike,forbidden,not|🚭~no smoking~forbidden,not,prohibited,smoke|🚯~no littering~forbidden,litter,not,prohibited|🚱~non-potable water~dry,non-drinking,non-potable,prohibited|🚷~no pedestrians~forbidden,not,pedestrian,prohibited|📵~no mobile phones~cell,forbidden,not,phone|🔞~no one under eighteen~18,age,forbidden,not|☢️~radioactive~sign|☣️~biohazard~sign|⬆️~up arrow~cardinal,direction,north|↗️~up-right arrow~direction,intercardinal,northeast,up-right|➡️~right arrow~cardinal,direction,east|↘️~down-right arrow~direction,down-right,intercardinal,southeast|⬇️~down arrow~cardinal,direction,south|↙️~down-left arrow~direction,down-left,intercardinal,southwest|⬅️~left arrow~cardinal,direction,west|↖️~up-left arrow~direction,intercardinal,northwest,up-left|↕️~up-down arrow~up-down|↔️~left-right arrow~left-right|↩️~right arrow curving left|↪️~left arrow curving right|⤴️~right arrow curving up|⤵️~right arrow curving down|🔃~clockwise vertical arrows~arrow,refresh,reload|🔄~counterclockwise arrows button~again,anticlockwise,arrow,deja|🔙~BACK arrow|🔚~END arrow|🔛~ON! arrow~mark,on!|🔜~SOON arrow~brb,omw|🔝~TOP arrow~homie,up|🛐~place of worship~pray,religion|⚛️~atom symbol~atheist|🕉️~om~hindu,religion|✡️~star of David~jew,jewish,judaism,religion|☸️~wheel of dharma~buddhist,religion|☯️~yin yang~difficult,lives,religion,tao|✝️~latin cross~christ,christian,religion|☦️~orthodox cross~christian,religion|☪️~star and crescent~islam,muslim,ramadan,religion|☮️~peace symbol~healing,peaceful|🕎~menorah~candelabrum,candlestick,hanukkah,jewish|🔯~dotted six-pointed star~fortune,jewish,judaism,six-pointed|🪯~khanda~deg,fateh,khalsa,religion|♈~Aries~horoscope,ram,zodiac|♉~Taurus~bull,horoscope,ox,zodiac|♊~Gemini~horoscope,twins,zodiac|♋~Cancer~crab,horoscope,zodiac|♌~Leo~horoscope,lion,zodiac|♍~Virgo~horoscope,zodiac|♎~Libra~balance,horoscope,justice,scales|♏~Scorpio~horoscope,scorpion,scorpius,zodiac|♐~Sagittarius~archer,horoscope,zodiac|♑~Capricorn~goat,horoscope,zodiac|♒~Aquarius~bearer,horoscope,water,zodiac|♓~Pisces~fish,horoscope,zodiac|⛎~Ophiuchus~bearer,serpent,snake,zodiac|🔀~shuffle tracks button~arrow,crossed|🔁~repeat button~arrow,clockwise|🔂~repeat single button~arrow,clockwise,once|▶️~play button~arrow,right,triangle|⏩~fast-forward button~arrow,double,fast-forward|⏭️~next track button~arrow,scene,triangle|⏯️~play or pause button~arrow,right,triangle|◀️~reverse button~arrow,left,triangle|⏪~fast reverse button~arrow,double,rewind|⏮️~last track button~arrow,previous,scene,triangle|🔼~upwards button~arrow,red,up|⏫~fast up button~arrow,double|🔽~downwards button~arrow,down,red|⏬~fast down button~arrow,double|⏸️~pause button~bar,double,vertical|⏹️~stop button~square|⏺️~record button~circle|⏏️~eject button|🎦~cinema~camera,film,movie|🔅~dim button~brightness,low|🔆~bright button~brightness,light|📶~antenna bars~bar,cell,communication,mobile|🛜~wireless~broadband,computer,connectivity,hotspot|📳~vibration mode~cell,communication,mobile,phone|📴~mobile phone off~cell,telephone|♀️~female sign~woman|♂️~male sign~man|⚧️~transgender symbol|✖️~multiply~×,cancel,multiplication,sign|➕~plus~+|➖~minus~-,−,heavy,math|➗~divide~÷,division,heavy,math|🟰~heavy equals sign~answer,equal,equality,math|♾️~infinity~forever,unbounded,universal|‼️~double exclamation mark~!,!!,bangbang,punctuation|⁉️~exclamation question mark~!,!?,?,interrobang|❓~red question mark~?,punctuation|❔~white question mark~?,outlined,punctuation|❕~white exclamation mark~!,outlined,punctuation|❗~red exclamation mark~!,punctuation|〰️~wavy dash~punctuation|💱~currency exchange~bank,money|💲~heavy dollar sign~billion,cash,charge,currency|⚕️~medical symbol~aesculapius,medicine,staff|♻️~recycling symbol~recycle|⚜️~fleur-de-lis~fleur-de-lis,knights|🔱~trident emblem~anchor,poseidon,ship,tool|📛~name badge|🔰~Japanese symbol for beginner~chevron,green,leaf,tool|⭕~hollow red circle~heavy,large,o|✅~check mark button~✓,checked,checkmark,complete|☑️~check box with check~✓,ballot,checked,done|✔️~check mark~✓,checked,checkmark,done|❌~cross mark~×,cancel,multiplication,multiply|❎~cross mark button~×,multiplication,multiply,square|➰~curly loop~curl|➿~double curly loop~curl|〽️~part alternation mark|✳️~eight-spoked asterisk~*,eight-spoked|✴️~eight-pointed star~*,eight-pointed|❇️~sparkle~*|©️~copyright~c|®️~registered~r|™️~trade mark~tm,trademark|#️⃣~keycap: #|*️⃣~keycap: *|0️⃣~keycap: 0~zero|1️⃣~keycap: 1~one|2️⃣~keycap: 2~two|3️⃣~keycap: 3~three|4️⃣~keycap: 4~four|5️⃣~keycap: 5~five|6️⃣~keycap: 6~six|7️⃣~keycap: 7~seven|8️⃣~keycap: 8~eight|9️⃣~keycap: 9~nine|🔟~keycap: 10|🔠~input latin uppercase~abcd,letters|🔡~input latin lowercase~abcd,letters|🔢~input numbers~1234|🔣~input symbols~&,%,♪,〒|🔤~input latin letters~abc,alphabet|🅰️~A button (blood type)|🆎~AB button (blood type)|🅱️~B button (blood type)|🆑~CL button|🆒~COOL button|🆓~FREE button|ℹ️~information~i|🆔~ID button~identity|Ⓜ️~circled M~circle|🆕~NEW button|🆖~NG button|🅾️~O button (blood type)|🆗~OK button~okay|🅿️~P button~parking|🆘~SOS button~help|🆙~UP! button~mark,up!|🆚~VS button~versus|🈁~Japanese “here” button~katakana|🈂️~Japanese “service charge” button~katakana|🈷️~Japanese “monthly amount” button~ideograph|🈶~Japanese “not free of charge” button~ideograph|🈯~Japanese “reserved” button~ideograph|🉐~Japanese “bargain” button~ideograph|🈹~Japanese “discount” button~ideograph|🈚~Japanese “free of charge” button~ideograph|🈲~Japanese “prohibited” button~ideograph|🉑~Japanese “acceptable” button~ideograph|🈸~Japanese “application” button~ideograph|🈴~Japanese “passing grade” button~ideograph|🈳~Japanese “vacancy” button~ideograph|㊗️~Japanese “congratulations” button~ideograph|㊙️~Japanese “secret” button~ideograph|🈺~Japanese “open for business” button~ideograph|🈵~Japanese “no vacancy” button~ideograph|🔴~red circle~geometric|🟠~orange circle|🟡~yellow circle|🟢~green circle|🔵~blue circle~geometric|🟣~purple circle|🟤~brown circle|⚫~black circle~geometric|⚪~white circle~geometric|🟥~red square~card,penalty|🟧~orange square|🟨~yellow square~card,penalty|🟩~green square|🟦~blue square|🟪~purple square|🟫~brown square|⬛~black large square~geometric|⬜~white large square~geometric|◼️~black medium square~geometric|◻️~white medium square~geometric|◾~black medium-small square~geometric,medium-small|◽~white medium-small square~geometric,medium-small|▪️~black small square~geometric|▫️~white small square~geometric|🔶~large orange diamond~geometric|🔷~large blue diamond~geometric|🔸~small orange diamond~geometric|🔹~small blue diamond~geometric|🔺~red triangle pointed up~geometric|🔻~red triangle pointed down~geometric|💠~diamond with a dot~comic,geometric|🔘~radio button~geometric|🔳~white square button~geometric,outlined|🔲~black square button~geometric" },
  { id: "flags", label: "Flags", data: "🏁~chequered flag~checkered,finish,flags,game|🚩~triangular flag~construction,golf,post|🎌~crossed flags~celebration,cross,japanese|🏴~black flag~waving|🏳️~white flag~waving|🏳️‍🌈~rainbow flag~bisexual,gay,genderqueer,glbt|🏳️‍⚧️~transgender flag~blue,light,pink,white|🏴‍☠️~pirate flag~jolly,plunder,roger,treasure|🇦🇨~flag: Ascension Island|🇦🇩~flag: Andorra|🇦🇪~flag: United Arab Emirates|🇦🇫~flag: Afghanistan|🇦🇬~flag: Antigua & Barbuda|🇦🇮~flag: Anguilla|🇦🇱~flag: Albania|🇦🇲~flag: Armenia|🇦🇴~flag: Angola|🇦🇶~flag: Antarctica|🇦🇷~flag: Argentina|🇦🇸~flag: American Samoa|🇦🇹~flag: Austria|🇦🇺~flag: Australia|🇦🇼~flag: Aruba|🇦🇽~flag: Åland Islands|🇦🇿~flag: Azerbaijan|🇧🇦~flag: Bosnia & Herzegovina|🇧🇧~flag: Barbados|🇧🇩~flag: Bangladesh|🇧🇪~flag: Belgium|🇧🇫~flag: Burkina Faso|🇧🇬~flag: Bulgaria|🇧🇭~flag: Bahrain|🇧🇮~flag: Burundi|🇧🇯~flag: Benin|🇧🇱~flag: St. Barthélemy|🇧🇲~flag: Bermuda|🇧🇳~flag: Brunei|🇧🇴~flag: Bolivia|🇧🇶~flag: Caribbean Netherlands|🇧🇷~flag: Brazil|🇧🇸~flag: Bahamas|🇧🇹~flag: Bhutan|🇧🇻~flag: Bouvet Island|🇧🇼~flag: Botswana|🇧🇾~flag: Belarus|🇧🇿~flag: Belize|🇨🇦~flag: Canada|🇨🇨~flag: Cocos (Keeling) Islands|🇨🇩~flag: Congo - Kinshasa|🇨🇫~flag: Central African Republic|🇨🇬~flag: Congo - Brazzaville|🇨🇭~flag: Switzerland|🇨🇮~flag: Côte d’Ivoire|🇨🇰~flag: Cook Islands|🇨🇱~flag: Chile|🇨🇲~flag: Cameroon|🇨🇳~flag: China|🇨🇴~flag: Colombia|🇨🇵~flag: Clipperton Island|🇨🇷~flag: Costa Rica|🇨🇺~flag: Cuba|🇨🇻~flag: Cape Verde|🇨🇼~flag: Curaçao|🇨🇽~flag: Christmas Island|🇨🇾~flag: Cyprus|🇨🇿~flag: Czechia|🇩🇪~flag: Germany|🇩🇬~flag: Diego Garcia|🇩🇯~flag: Djibouti|🇩🇰~flag: Denmark|🇩🇲~flag: Dominica|🇩🇴~flag: Dominican Republic|🇩🇿~flag: Algeria|🇪🇦~flag: Ceuta & Melilla|🇪🇨~flag: Ecuador|🇪🇪~flag: Estonia|🇪🇬~flag: Egypt|🇪🇭~flag: Western Sahara|🇪🇷~flag: Eritrea|🇪🇸~flag: Spain|🇪🇹~flag: Ethiopia|🇪🇺~flag: European Union|🇫🇮~flag: Finland|🇫🇯~flag: Fiji|🇫🇰~flag: Falkland Islands|🇫🇲~flag: Micronesia|🇫🇴~flag: Faroe Islands|🇫🇷~flag: France|🇬🇦~flag: Gabon|🇬🇧~flag: United Kingdom|🇬🇩~flag: Grenada|🇬🇪~flag: Georgia|🇬🇫~flag: French Guiana|🇬🇬~flag: Guernsey|🇬🇭~flag: Ghana|🇬🇮~flag: Gibraltar|🇬🇱~flag: Greenland|🇬🇲~flag: Gambia|🇬🇳~flag: Guinea|🇬🇵~flag: Guadeloupe|🇬🇶~flag: Equatorial Guinea|🇬🇷~flag: Greece|🇬🇸~flag: South Georgia & South Sandwich Islands|🇬🇹~flag: Guatemala|🇬🇺~flag: Guam|🇬🇼~flag: Guinea-Bissau|🇬🇾~flag: Guyana|🇭🇰~flag: Hong Kong SAR China|🇭🇲~flag: Heard Island & McDonald Islands|🇭🇳~flag: Honduras|🇭🇷~flag: Croatia|🇭🇹~flag: Haiti|🇭🇺~flag: Hungary|🇮🇨~flag: Canary Islands|🇮🇩~flag: Indonesia|🇮🇪~flag: Ireland|🇮🇱~flag: Israel|🇮🇲~flag: Isle of Man|🇮🇳~flag: India|🇮🇴~flag: British Indian Ocean Territory|🇮🇶~flag: Iraq|🇮🇷~flag: Iran|🇮🇸~flag: Iceland|🇮🇹~flag: Italy|🇯🇪~flag: Jersey|🇯🇲~flag: Jamaica|🇯🇴~flag: Jordan|🇯🇵~flag: Japan|🇰🇪~flag: Kenya|🇰🇬~flag: Kyrgyzstan|🇰🇭~flag: Cambodia|🇰🇮~flag: Kiribati|🇰🇲~flag: Comoros|🇰🇳~flag: St. Kitts & Nevis|🇰🇵~flag: North Korea|🇰🇷~flag: South Korea|🇰🇼~flag: Kuwait|🇰🇾~flag: Cayman Islands|🇰🇿~flag: Kazakhstan|🇱🇦~flag: Laos|🇱🇧~flag: Lebanon|🇱🇨~flag: St. Lucia|🇱🇮~flag: Liechtenstein|🇱🇰~flag: Sri Lanka|🇱🇷~flag: Liberia|🇱🇸~flag: Lesotho|🇱🇹~flag: Lithuania|🇱🇺~flag: Luxembourg|🇱🇻~flag: Latvia|🇱🇾~flag: Libya|🇲🇦~flag: Morocco|🇲🇨~flag: Monaco|🇲🇩~flag: Moldova|🇲🇪~flag: Montenegro|🇲🇫~flag: St. Martin|🇲🇬~flag: Madagascar|🇲🇭~flag: Marshall Islands|🇲🇰~flag: North Macedonia|🇲🇱~flag: Mali|🇲🇲~flag: Myanmar (Burma)|🇲🇳~flag: Mongolia|🇲🇴~flag: Macao SAR China|🇲🇵~flag: Northern Mariana Islands|🇲🇶~flag: Martinique|🇲🇷~flag: Mauritania|🇲🇸~flag: Montserrat|🇲🇹~flag: Malta|🇲🇺~flag: Mauritius|🇲🇻~flag: Maldives|🇲🇼~flag: Malawi|🇲🇽~flag: Mexico|🇲🇾~flag: Malaysia|🇲🇿~flag: Mozambique|🇳🇦~flag: Namibia|🇳🇨~flag: New Caledonia|🇳🇪~flag: Niger|🇳🇫~flag: Norfolk Island|🇳🇬~flag: Nigeria|🇳🇮~flag: Nicaragua|🇳🇱~flag: Netherlands|🇳🇴~flag: Norway|🇳🇵~flag: Nepal|🇳🇷~flag: Nauru|🇳🇺~flag: Niue|🇳🇿~flag: New Zealand|🇴🇲~flag: Oman|🇵🇦~flag: Panama|🇵🇪~flag: Peru|🇵🇫~flag: French Polynesia|🇵🇬~flag: Papua New Guinea|🇵🇭~flag: Philippines|🇵🇰~flag: Pakistan|🇵🇱~flag: Poland|🇵🇲~flag: St. Pierre & Miquelon|🇵🇳~flag: Pitcairn Islands|🇵🇷~flag: Puerto Rico|🇵🇸~flag: Palestinian Territories|🇵🇹~flag: Portugal|🇵🇼~flag: Palau|🇵🇾~flag: Paraguay|🇶🇦~flag: Qatar|🇷🇪~flag: Réunion|🇷🇴~flag: Romania|🇷🇸~flag: Serbia|🇷🇺~flag: Russia|🇷🇼~flag: Rwanda|🇸🇦~flag: Saudi Arabia|🇸🇧~flag: Solomon Islands|🇸🇨~flag: Seychelles|🇸🇩~flag: Sudan|🇸🇪~flag: Sweden|🇸🇬~flag: Singapore|🇸🇭~flag: St. Helena, Ascension & Tristan da Cunha|🇸🇮~flag: Slovenia|🇸🇯~flag: Svalbard & Jan Mayen|🇸🇰~flag: Slovakia|🇸🇱~flag: Sierra Leone|🇸🇲~flag: San Marino|🇸🇳~flag: Senegal|🇸🇴~flag: Somalia|🇸🇷~flag: Suriname|🇸🇸~flag: South Sudan|🇸🇹~flag: São Tomé & Príncipe|🇸🇻~flag: El Salvador|🇸🇽~flag: Sint Maarten|🇸🇾~flag: Syria|🇸🇿~flag: Eswatini|🇹🇦~flag: Tristan da Cunha|🇹🇨~flag: Turks & Caicos Islands|🇹🇩~flag: Chad|🇹🇫~flag: French Southern and Antarctic Lands|🇹🇬~flag: Togo|🇹🇭~flag: Thailand|🇹🇯~flag: Tajikistan|🇹🇰~flag: Tokelau|🇹🇱~flag: Timor-Leste|🇹🇲~flag: Turkmenistan|🇹🇳~flag: Tunisia|🇹🇴~flag: Tonga|🇹🇷~flag: Türkiye|🇹🇹~flag: Trinidad & Tobago|🇹🇻~flag: Tuvalu|🇹🇼~flag: Taiwan|🇹🇿~flag: Tanzania|🇺🇦~flag: Ukraine|🇺🇬~flag: Uganda|🇺🇲~flag: U.S. Outlying Islands|🇺🇳~flag: United Nations|🇺🇸~flag: United States|🇺🇾~flag: Uruguay|🇺🇿~flag: Uzbekistan|🇻🇦~flag: Vatican City|🇻🇨~flag: St. Vincent & Grenadines|🇻🇪~flag: Venezuela|🇻🇬~flag: British Virgin Islands|🇻🇮~flag: U.S. Virgin Islands|🇻🇳~flag: Vietnam|🇻🇺~flag: Vanuatu|🇼🇫~flag: Wallis & Futuna|🇼🇸~flag: Samoa|🇽🇰~flag: Kosovo|🇾🇪~flag: Yemen|🇾🇹~flag: Mayotte|🇿🇦~flag: South Africa|🇿🇲~flag: Zambia|🇿🇼~flag: Zimbabwe|🏴󠁧󠁢󠁥󠁮󠁧󠁿~flag: England|🏴󠁧󠁢󠁳󠁣󠁴󠁿~flag: Scotland|🏴󠁧󠁢󠁷󠁬󠁳󠁿~flag: Wales" },
];

interface Emoji { emoji: string; name: string; label: string; keywords: string[]; search: string; tones?: number[]; order: number }
interface Category { id: string; label: string; emojis: Emoji[] }
interface Dataset { categories: Category[]; byEmoji: Map<string, Emoji>; all: Emoji[] }
type Row =
  | { kind: "header"; section: number; label: string; top: number; height: number }
  | { kind: "emojis"; section: number; items: Emoji[]; first: number; top: number; height: number };

const VS16 = "\uFE0F";
const TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];
const TONE_NAMES = ["Default", "Light", "Medium light", "Medium", "Medium dark", "Dark"];
const POPULAR = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "😊", "👀", "✅", "🙌", "💯", "😍", "🤔", "👏", "🚀", "😅", "🥳", "👋"];
const ICONS: Record<string, LucideIcon> = { recent: Clock, people: Smile, nature: PawPrint, food: Coffee, activity: Volleyball, travel: Plane, objects: Lightbulb, symbols: Shapes, flags: Flag };
const HEADER = 30;
const MEMORY_KEY = "\0arc-emoji-picker";

let dataset: Dataset | null = null;
function getDataset(): Dataset {
  if (dataset) return dataset;
  const byEmoji = new Map<string, Emoji>();
  const all: Emoji[] = [];
  const categories = SOURCE.map(category => ({
    id: category.id,
    label: category.label,
    emojis: category.data.split("|").map(entry => {
      const [emoji, name, keywords = "", tones = ""] = entry.split("~");
      const item: Emoji = {
        emoji,
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        keywords: keywords ? keywords.split(",") : [],
        search: `${name.toLowerCase()} ${keywords.replaceAll(",", " ")}`,
        tones: tones ? tones.split(".").map(Number) : undefined,
        order: all.length,
      };
      all.push(item);
      byEmoji.set(emoji, item);
      byEmoji.set(emoji.replaceAll(VS16, ""), item);
      return item;
    }),
  }));
  dataset = { categories, byEmoji, all };
  return dataset;
}

function withTone(item: Emoji, tone: number) {
  if (!tone || !item.tones) return item.emoji;
  const points = Array.from(item.emoji);
  let out = "";
  for (let i = 0; i < points.length; i++) {
    out += points[i];
    if (item.tones.includes(i)) {
      out += TONES[tone];
      if (points[i + 1] === VS16) i++;
    }
  }
  return out;
}

function search(all: Emoji[], query: string) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const phrase = words.join(" ");
  const found: { item: Emoji; score: number }[] = [];
  for (const item of all) {
    if (!words.every(word => item.search.includes(word))) continue;
    const name = item.name.toLowerCase();
    const score = name === phrase ? 0 : name.startsWith(phrase) ? 1 : name.includes(` ${phrase}`) ? 2 : item.keywords.some(keyword => keyword.startsWith(phrase)) ? 3 : name.includes(phrase) ? 4 : 5;
    found.push({ item, score });
  }
  return found.sort((a, b) => a.score - b.score || a.item.order - b.item.order).map(entry => entry.item);
}

/* Recent emoji and the tone, shared by every picker on the page. */
const memory = new Map<string, string>();
const listeners = new Set<() => void>();
function writeStore(key: string, value: string) {
  memory.set(key, value);
  if (key !== MEMORY_KEY) {
    try { window.localStorage.setItem(key, value); } catch { /* Blocked storage falls back to memory. */ }
  }
  listeners.forEach(listener => listener());
}
function readStore(key: string) {
  if (key !== MEMORY_KEY) {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return stored;
    } catch { /* Blocked storage falls back to memory. */ }
  }
  return memory.get(key) ?? null;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function parseStore(raw: string | null): { recent: string[]; tone: SkinTone } {
  try {
    const value = raw ? JSON.parse(raw) : {};
    const recent = Array.isArray(value.recent) ? value.recent.filter((entry: unknown): entry is string => typeof entry === "string") : [];
    const tone = typeof value.tone === "number" && value.tone >= 0 && value.tone <= 5 ? value.tone : 0;
    return { recent, tone };
  } catch {
    return { recent: [], tone: 0 };
  }
}

function ToneHand({ value }: { value: number }) {
  return <span className={styles.emojiGlyph}>{`✋${TONES[value]}`}</span>;
}

export function EmojiPicker({
  onSelect,
  skinTone,
  defaultSkinTone,
  onSkinToneChange,
  storageKey = "arc-emoji-picker",
  recentLimit = 27,
  defaultRecent = POPULAR,
  columns,
  autoFocus = false,
  searchPlaceholder = "Search emoji",
  label = "Emoji picker",
  className,
  style,
}: EmojiPickerProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const data = getDataset();
  const key = storageKey ?? MEMORY_KEY;
  const raw = useSyncExternalStore(subscribe, () => readStore(key), () => null);
  const stored = useMemo(() => parseStore(raw), [raw]);
  const tone: SkinTone = skinTone ?? (raw === null && defaultSkinTone !== undefined ? defaultSkinTone : stored.tone);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [box, setBox] = useState({ width: 336, height: 280 });
  const [target, setTarget] = useState<number | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [gridFocused, setGridFocused] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const toneButtonRef = useRef<HTMLButtonElement>(null);
  const tonesRef = useRef<HTMLDivElement>(null);
  const pendingTab = useRef<number | null>(null);
  const targetTimer = useRef<number | undefined>(undefined);

  const recent = useMemo(
    () => (stored.recent.length ? stored.recent : defaultRecent)
      .map(emoji => data.byEmoji.get(emoji) ?? data.byEmoji.get(emoji.replaceAll(VS16, "")))
      .filter((item): item is Emoji => !!item),
    [stored.recent, defaultRecent, data],
  );
  const recentLabel = stored.recent.length ? "Recently used" : "Popular";
  const sections = useMemo<Category[]>(() => [{ id: "recent", label: recentLabel, emojis: recent }, ...data.categories], [recent, recentLabel, data]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? search(data.all, query) : []), [searching, query, data]);
  const shown = useMemo<Category[]>(() => (searching ? (results.length ? [{ id: "results", label: "Search results", emojis: results }] : []) : sections), [searching, results, sections]);
  const columnCount = Math.max(1, columns ?? Math.max(6, Math.floor(box.width / 36)));
  const cell = box.width / columnCount;

  const { rows, flat, total } = useMemo(() => {
    const rows: Row[] = [];
    const flat: { item: Emoji; row: number; col: number }[] = [];
    let top = 0;
    shown.forEach((section, index) => {
      rows.push({ kind: "header", section: index, label: section.label, top, height: HEADER });
      top += HEADER;
      for (let start = 0; start < section.emojis.length; start += columnCount) {
        const items = section.emojis.slice(start, start + columnCount);
        const row = rows.length;
        rows.push({ kind: "emojis", section: index, items, first: flat.length, top, height: cell });
        items.forEach((item, col) => flat.push({ item, row, col }));
        top += cell;
      }
    });
    return { rows, flat, total: top + 8 };
  }, [shown, columnCount, cell]);
  const headerTops = useMemo(() => rows.filter(row => row.kind === "header").map(row => row.top), [rows]);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const measure = () => {
      const computed = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
      setBox(previous => (previous.width === width && previous.height === node.clientHeight ? previous : { width, height: node.clientHeight }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const changeQuery = (value: string) => {
    setQuery(value);
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    setScrollTop(0);
    setActive(value.trim() ? 0 : null);
  };

  const inView = useMemo(() => {
    if (searching || !headerTops.length) return -1;
    if (scrollTop + box.height >= total - 4) return headerTops.length - 1;
    let index = 0;
    for (let i = 0; i < headerTops.length; i++) if (headerTops[i] <= scrollTop + 12) index = i;
    return index;
  }, [searching, headerTops, scrollTop, box.height, total]);
  const current = target ?? inView;

  const scrollToSection = useCallback((index: number) => {
    const node = scrollerRef.current;
    if (!node) return;
    const top = Math.min(headerTops[index] ?? 0, Math.max(0, total - node.clientHeight));
    setTarget(index);
    window.clearTimeout(targetTimer.current);
    targetTimer.current = window.setTimeout(() => setTarget(null), reduced ? 50 : 1600);
    node.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }, [headerTops, total, reduced]);
  useEffect(() => () => window.clearTimeout(targetTimer.current), []);

  useLayoutEffect(() => {
    if (pendingTab.current === null || searching) return;
    const index = pendingTab.current;
    pendingTab.current = null;
    scrollToSection(index);
  }, [searching, scrollToSection]);

  const pick = (item: Emoji, event: MouseEvent | KeyboardEvent) => {
    writeStore(key, JSON.stringify({ recent: [item.emoji, ...stored.recent.filter(emoji => emoji !== item.emoji)].slice(0, recentLimit), tone: stored.tone }));
    onSelect?.({ emoji: withTone(item, tone), base: item.emoji, name: item.label, skinTone: item.tones ? tone : 0 }, event);
  };

  const reveal = useCallback((index: number) => {
    const node = scrollerRef.current;
    const entry = flat[index];
    if (!node || !entry) return;
    const row = rows[entry.row];
    const top = rows[entry.row - 1]?.kind === "header" ? row.top - HEADER : row.top;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (row.top + row.height > node.scrollTop + node.clientHeight) node.scrollTop = row.top + row.height - node.clientHeight + 4;
  }, [flat, rows]);

  const moveTo = (index: number) => {
    const next = Math.min(Math.max(index, 0), flat.length - 1);
    setActive(next);
    reveal(next);
  };

  const vertical = (index: number, direction: 1 | -1) => {
    const entry = flat[index];
    for (let r = entry.row + direction; r >= 0 && r < rows.length; r += direction) {
      const row = rows[r];
      if (row.kind === "emojis") return row.first + Math.min(entry.col, row.items.length - 1);
    }
    return null;
  };

  const escapeState = useRef({ toneOpen, searching, clear: () => {} });
  useEffect(() => {
    escapeState.current = { toneOpen, searching, clear: () => changeQuery("") };
  });
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !rootRef.current?.contains(document.activeElement)) return;
      const state = escapeState.current;
      if (state.toneOpen) {
        event.preventDefault();
        setToneOpen(false);
        toneButtonRef.current?.focus();
      } else if (state.searching) {
        event.preventDefault();
        state.clear();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    if (!toneOpen) return;
    tonesRef.current?.querySelector<HTMLElement>("[aria-checked='true']")?.focus({ preventScroll: true });
  }, [toneOpen]);

  const visible = useMemo(() => {
    const from = scrollTop - 160;
    const to = scrollTop + box.height + 160;
    const list: number[] = [];
    let low = 0;
    let high = rows.length - 1;
    let start = rows.length;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (rows[middle].top + rows[middle].height >= from) { start = middle; high = middle - 1; } else low = middle + 1;
    }
    for (let i = start; i < rows.length && rows[i].top <= to; i++) list.push(i);
    const activeRow = active !== null ? flat[active]?.row : undefined;
    if (activeRow !== undefined && !list.includes(activeRow)) list.push(activeRow);
    return list;
  }, [rows, scrollTop, box.height, active, flat]);

  const activeItem = active !== null ? flat[active]?.item : undefined;
  const cellId = (index: number) => `${id}-cell-${index}`;
  const activeId = activeItem && active !== null ? cellId(active) : undefined;
  const wave = data.byEmoji.get("👋");

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!flat.length) return;
    const index = active ?? 0;
    const page = Math.max(1, Math.floor(box.height / cell) - 1);
    switch (event.key) {
      case "ArrowRight": event.preventDefault(); moveTo(active === null ? 0 : index + 1); return;
      case "ArrowLeft": event.preventDefault(); moveTo(active === null ? 0 : index - 1); return;
      case "ArrowDown": {
        event.preventDefault();
        if (active === null) return moveTo(0);
        const next = vertical(index, 1);
        if (next !== null) moveTo(next);
        return;
      }
      case "ArrowUp": {
        event.preventDefault();
        const next = active === null ? null : vertical(index, -1);
        if (next === null) inputRef.current?.focus(); else moveTo(next);
        return;
      }
      case "PageDown":
      case "PageUp": {
        event.preventDefault();
        let next = index;
        for (let i = 0; i < page; i++) {
          const step = vertical(next, event.key === "PageDown" ? 1 : -1);
          if (step === null) break;
          next = step;
        }
        moveTo(next);
        return;
      }
      case "Home": {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) return moveTo(0);
        const row = rows[flat[index].row];
        if (row.kind === "emojis") moveTo(row.first);
        return;
      }
      case "End": {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) return moveTo(flat.length - 1);
        const row = rows[flat[index].row];
        if (row.kind === "emojis") moveTo(row.first + row.items.length - 1);
        return;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        if (active !== null && flat[active]) pick(flat[active].item, event);
        return;
    }
    if ((event.key.length === 1 || event.key === "Backspace") && !event.ctrlKey && !event.metaKey && !event.altKey) inputRef.current?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={[styles.picker, className].filter(Boolean).join(" ")}
      style={{ ...style, "--emoji-cell": `${cell}px` } as CSSProperties}
      role="group"
      aria-label={label}
    >
      <div className={styles.header}>
        <label className={styles.search}>
          <Search className={styles.searchIcon} width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="searchbox"
            value={query}
            onChange={event => changeQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (flat.length) {
                  if (active === null) moveTo(0);
                  scrollerRef.current?.focus({ preventScroll: true });
                }
              } else if (event.key === "Enter" && active !== null && flat[active]) {
                event.preventDefault();
                pick(flat[active].item, event);
              }
            }}
            placeholder={searchPlaceholder}
            aria-label="Search emoji"
            aria-controls={`${id}-grid`}
            aria-activedescendant={searching ? activeId : undefined}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          {query ? (
            <button type="button" className={styles.clear} onClick={() => { changeQuery(""); inputRef.current?.focus(); }} aria-label="Clear search">
              <X width={14} height={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <button ref={toneButtonRef} type="button" className={styles.toneButton} onClick={() => setToneOpen(true)} aria-haspopup="true" aria-expanded={toneOpen} aria-label={`Skin tone: ${TONE_NAMES[tone]}`}>
          <ToneHand value={tone} />
        </button>
        <div
          ref={tonesRef}
          className={styles.tones}
          data-open={toneOpen || undefined}
          role="radiogroup"
          aria-label="Skin tone"
          onKeyDown={event => {
            const radios = Array.from(tonesRef.current?.querySelectorAll<HTMLElement>("[role='radio']") ?? []);
            const index = radios.indexOf(document.activeElement as HTMLElement);
            const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
            if (step) {
              event.preventDefault();
              radios[(index + step + radios.length) % radios.length]?.focus();
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              radios[event.key === "Home" ? 0 : radios.length - 1]?.focus();
            } else if (event.key === "Tab") setToneOpen(false);
          }}
          onBlur={event => {
            if (toneOpen && !event.currentTarget.contains(event.relatedTarget)) setToneOpen(false);
          }}
        >
          {TONE_NAMES.map((name, index) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={tone === index}
              aria-label={name}
              tabIndex={tone === index ? 0 : -1}
              className={styles.tone}
              onClick={() => {
                if (skinTone === undefined) writeStore(key, JSON.stringify({ recent: stored.recent, tone: index }));
                onSkinToneChange?.(index as SkinTone);
                setToneOpen(false);
                toneButtonRef.current?.focus();
              }}
            >
              <ToneHand value={index} />
            </button>
          ))}
        </div>
      </div>
      <div
        className={styles.tabs}
        role="toolbar"
        aria-label="Categories"
        style={{ "--emoji-tabs": sections.length } as CSSProperties}
        onKeyDown={event => {
          const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (!step || index < 0) return;
          event.preventDefault();
          buttons[(index + step + buttons.length) % buttons.length]?.focus();
        }}
      >
        {sections.map((section, index) => {
          const Icon = ICONS[section.id] ?? Smile;
          const isCurrent = current === index;
          return (
            <button
              key={section.id}
              type="button"
              className={styles.tab}
              data-current={isCurrent || undefined}
              aria-current={isCurrent || undefined}
              aria-label={section.label}
              tabIndex={index === Math.max(current, 0) ? 0 : -1}
              onClick={() => {
                setActive(null);
                if (searching) {
                  pendingTab.current = index;
                  changeQuery("");
                  return;
                }
                scrollToSection(index);
              }}
            >
              <Icon width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          );
        })}
        <motion.span
          className={styles.indicator}
          aria-hidden="true"
          initial={false}
          animate={{ x: `${100 * Math.max(current, 0)}%`, opacity: current < 0 ? 0 : 1 }}
          transition={reduced ? { duration: 0 } : { x: motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }}
        />
      </div>
      <div
        ref={scrollerRef}
        id={`${id}-grid`}
        className={styles.scroller}
        role="grid"
        aria-label={searching ? "Search results" : "Emoji"}
        aria-rowcount={rows.length}
        aria-colcount={columnCount}
        aria-activedescendant={gridFocused ? activeId : undefined}
        tabIndex={flat.length ? 0 : -1}
        onKeyDown={onGridKeyDown}
        onFocus={event => {
          if (event.target !== event.currentTarget) return;
          setGridFocused(true);
          if (active === null && flat.length) setActive(0);
        }}
        onBlur={event => { if (event.target === event.currentTarget) setGridFocused(false); }}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        onScrollEnd={() => {
          if (target !== null) {
            window.clearTimeout(targetTimer.current);
            setTarget(null);
          }
        }}
        onWheel={() => { if (target !== null) setTarget(null); }}
        onTouchStart={() => { if (target !== null) setTarget(null); }}
        onPointerLeave={() => { if (!gridFocused && !searching) setActive(null); }}
      >
        {flat.length ? (
          <div className={styles.canvas} style={{ height: total }}>
            {visible.map(index => {
              const row = rows[index];
              if (row.kind === "header") {
                return (
                  <div key={`h${index}`} role="row" aria-rowindex={index + 1} className={styles.sectionRow} style={{ transform: `translateY(${row.top}px)`, height: row.height }}>
                    <span role="columnheader" aria-colspan={columnCount} className={styles.sectionLabel}>{row.label}</span>
                  </div>
                );
              }
              return (
                <div key={`r${index}`} role="row" aria-rowindex={index + 1} className={styles.row} style={{ transform: `translateY(${row.top}px)`, height: row.height, gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}>
                  {row.items.map((item, col) => {
                    const position = row.first + col;
                    return (
                      <button
                        key={item.emoji}
                        id={cellId(position)}
                        type="button"
                        role="gridcell"
                        tabIndex={-1}
                        aria-label={item.label}
                        aria-selected={active === position}
                        data-active={active === position || undefined}
                        className={styles.cell}
                        onPointerMove={event => { if (event.pointerType === "mouse" && active !== position) setActive(position); }}
                        onMouseDown={event => event.preventDefault()}
                        onClick={event => { setActive(position); pick(item, event); }}
                      >
                        <span className={styles.emojiGlyph}>{withTone(item, tone)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No emoji match “{query.trim()}”</p>
            <p className={styles.emptyHint}>Try a shorter or different word</p>
          </div>
        )}
      </div>
      <div className={styles.preview} aria-hidden="true">
        {activeItem ? (
          <>
            <span key={activeItem.emoji} className={[styles.previewGlyph, styles.emojiGlyph].join(" ")}>{withTone(activeItem, tone)}</span>
            <span className={styles.previewText}>
              <span className={styles.previewName}>{activeItem.label}</span>
              {activeItem.keywords.length > 0 ? <span className={styles.previewKeywords}>{activeItem.keywords.slice(0, 3).join(", ")}</span> : null}
            </span>
          </>
        ) : (
          <>
            <span className={[styles.previewGlyph, styles.previewIdle, styles.emojiGlyph].join(" ")}>{wave ? withTone(wave, tone) : "👋"}</span>
            <span className={styles.previewText}><span className={styles.previewHint}>Pick an emoji</span></span>
          </>
        )}
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{searching ? (results.length ? `${results.length} emoji found` : "No emoji found") : ""}</span>
    </div>
  );
}
