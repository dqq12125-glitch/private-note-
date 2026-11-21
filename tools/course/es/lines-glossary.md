# Spanish story lines: glossary and rules

This glossary covers all Spanish story lines. Every batch is now merged into **`tools/course/es/lines.json`**, which is the only file of record (the `lines.part-*.json` files are gone). Use the same forms when you add or revise lines. If a term here and a term in `lines.json` (`terms`, `templates`) ever differ, `lines.json` is right, because the game puts those words into templates. §9 lists the decisions from the consistency pass.

Format contract: `tools/course/SPEC.md` §8. Check your file with `node tools/course/lines-part.js check es <file>`.

## 1. Register and level

- **Neutral Latin American Spanish.** Always use **tú**; plural "you" is **ustedes** (never vosotros). Do not use words that only one country says. The course prefers: computadora, celular, jugo, pastel, materia, tarea, bicicleta, lentes, papas fritas, comida chatarra, boleto, tomar (a drink), escuela, maestra (teacher).
- **Keep it A1–A2.** Use present tense, `ir a` + infinitive for the future ("vas a ser fuerte", not "serás"), and only the most common preterites (fui, vi, comí, gané, ganaste, llegó, se fue). Short sentences. Prefer course words (see `towns.json`: colores, familia, escuela, materias, reloj, cumpleaños, animales, reglas, deporte y comida, el tiempo, un día especial).
- Avoid the subjunctive when a simple form works: "¡Di las palabras mágicas y va a brillar!", not "…para que brille".
- **NPCs use tú with the player. The player uses tú with everyone**, adults included. The course only introduces usted at level 2, so the batch-g frames ("Perdón, ¿eres la mamá de Tim?", "¿Eres la abuela?") use tú.
- **`speak`, `ask` and `opt` lines** are said aloud by the learner. Keep them short (about 2–7 words), natural and easy to pronounce. Inside one question, the right answer and every wrong option must **mean different things** in Spanish, not just in English (see §8 for the Good evening / Good night trap).
- **`sign` lines** are signs and stone tablets. Keep them terse: "Cueva Eco. ¡Adentro está oscuro!"
- The `zh` text is context, not a meaning to copy. Translate the English line, using `zh` and the source (`src`) to understand it.
- Content rules: no romance, violence, alcohol or tobacco, gambling, religion, politics or body-shaming. For monster battles use **batalla**. You may use luchar sparingly (villains), and never words like matar, sangre or golpear a alguien. Use "te quiero" only between family members or with a pet monster.

## 2. Gender: the player and the rival can be either

- **The player (`{name}`) can be a boy or a girl, and so can the rival (`{rival}`, Leo or Mia).** Never write an adjective or noun that agrees with them: no bienvenido/a, listo/a, cansado/a, nuevo vecino, campeón, entrenador, hijo, solo, contento.
- Rewrite instead:
  - Welcome → "¡Qué bueno verte!", "Te damos la bienvenida", or "Te doy la bienvenida, {name}."
  - Are you ready? → "¿Empezamos?" or "¡Atención!"
  - You look tired → "Tienes cara de sueño."
  - My child {rival} → "Allí está {rival}. ¡Yo soy su mamá!"
  - Young trainer → "¡Hola, joven!" (joven, agente, rival, estudiante and valiente are the same for both genders.)
  - You are the champion → "¡Ganaste la copa!" or "¡Tú sí sabes ganar!"
  - The child who talks to monsters → "tú eres quien habla con los monstruos"; the bravest speakers → "quienes hablan con más valor".
- The plurals vecinos, juntos, amigos and Bienvenidos (a sign or the whole audience) are fine: generic masculine for a mixed group.
- **Monsters are grammatically masculine** (el monstruo): "Cuídalo", "Eres mi amigo", "¡Bienvenido a mi equipo!" Still, avoid adjectives when it costs nothing: "{mon} ya no puede seguir" rather than "está cansado".
- NPCs whose gender is known (the `g` on the speaker in the source) use their real gender: la profesora Echo, la capitana Polly, Susurro (f), Retumbo (m).

## 3. Names and placeholders

- `{name}` and `{rival}` stay **exactly once each**, untouched. Template slots (`{mon}`, `{x1}`…) also appear exactly once.
- **Monster names stay in English** (Nibbler, Echodrake, Tickturtle, Skyecho, Daysprout, Lullaby…). They are proper names: write them as they are, with no article ("¡Llegó Lullaby!"). The only renamed monster is **Pinchy → Pinzy** ("pinchi" sounds like a Mexican swear word).
- Personal names of people and Isle Masters stay as they are (Polly, Tim, Kai, Lily, Lucy, Amy, Orion, Sage, Luna, Frost, Talon, Aria, Crabby, Flo, Rex, Puffy, Croc, Sharky, Whaley, Octo). Translate only the title in front, in lower case mid-sentence: la capitana Polly, el doctor Octo, la abuela Tortuga, el gallo Rex, el oficial Lee. Take the gender of the title from the speaker's `g`. For masters named "title + animal" (Rainbow Crab, Coach Seal…), translate the animal too; see §9.
- Real-world Spanish first names (Ana, Luis…) belong to the course content, not to the story. Do not rename story characters.

## 4. Fixed terms

### People and groups

| English | Spanish |
| --- | --- |
| Professor Echo (female) | la profesora Echo (the name does not change; address: "¡Mucho gusto, profesora!") |
| the rival `{rival}` | `{rival}` / tu rival (rival works for both genders) |
| Isle Master(s) | **el Jefe / la Jefa de la Isla**, plural **los Jefes de las Islas** (generic lines use the masculine; use Jefa for a female master). **Not** "guardián" (it clashes with *el guardia*, the gate guard) and **not** "líder". |
| the guard (blocks the road north) | el guardia |
| Amy, the station keeper | Amy, la encargada de la Parada de Descanso |
| Team Hush | **la Banda Silencio** |
| Hush Crew (a grunt) | un miembro de la Banda Silencio / los de la Banda Silencio |
| Admin Whisper (female) | Susurro |
| Admin Rumble (male) | Retumbo |
| Mr. Mute | el señor Callado (not "Mudo") |
| the Hush King | el Rey del Silencio |
| English Cup masters (Sage m, Luna f, Frost f, Talon m) | maestro / maestra: "Soy Sage, el maestro de las palabras." |
| Champion Aria | Aria, la campeona de español |
| Orion (mentor) | Orion |
| Junior Officer (the player in Rule City) | joven agente |
| trainer (an NPC whose gender is known) | entrenador / entrenadora; never for the player |
| islanders | la gente de las islas |

### Places

All place names are in `terms.place` of `lines.part-g.json`. Use them exactly. The towns are **Isla Hola, Isla Colores, Isla Familia, Isla Escuela, Isla Materias, Isla Clubes, Isla Reloj, Isla Fiesta, Isla Animal, Ciudad Reglas, Isla Deporte, Isla Clima, Isla Recuerdo**. They take no article: "Bienvenidos a Isla Hola", "Viniste desde Isla Hola".

Other place words:

| English | Spanish |
| --- | --- |
| Echo Island (the game world) | Isla Eco |
| Route n | Ruta n |
| Sea Route | Ruta Marina |
| Challenge Hall | la Sala de Retos (a specific one: Sala Hola, Sala Colores…) |
| Rest Stop | la Parada de Descanso |
| shop | la tienda |
| Brave Road | el Camino del Valor |
| Champion Plateau | la Meseta de Campeones |
| English Cup | la Copa de Español |
| Hush Base | la Base Silencio |
| monster box (the PC storage) | la caja de monstruos |
| the computer | la computadora |
| daycare | la guardería |
| town | el pueblo (Rule City is la ciudad) |

### Objects

Item names are in `terms.item`. The recurring nouns:

| English | Spanish |
| --- | --- |
| echo shell (the skill items, the starter shells) | **la caracola** ("Caracola Eco: Abrir Camino"). Never write "concha": it is vulgar in the River Plate area. |
| golden echo shell / Gold Echo Ball | la Bola Eco Dorada |
| Echo Ball | la Bola Eco |
| badge | **la insignia** (not "medalla") |
| crystal | el cristal ("el Cristal de los Colores"…) |
| Island Pass | el Pase de la Isla |
| handbook (monster book) | el libro de monstruos |
| egg / shining egg / hatch | el huevo / el huevo brillante / nacer ("Camina con él y pronto va a nacer.") |
| potion | la poción |
| Quiet Spray | el Spray Silencio |
| Team Headset | el Auricular de Equipo |
| evolution tunes | la Canción del Fuego, de las Olas… |
| coins | las monedas |
| bag | la mochila |
| ferry | el barco |
| statue | la estatua |
| gate (opened by puzzles) | la puerta: "¡La puerta se abrió!" / "La puerta está cerrada." |
| speakers (sound) | los altavoces |
| glasses | los lentes |

### Echo skills (`terms.skill`)

| Skill | Spanish |
| --- | --- |
| Clear Way, Clear Way 2, Clear Way 3 | Abrir Camino, Abrir Camino 2, Abrir Camino 3 |
| Light Up | Iluminar |
| Water Way, Water Way 2, Water Way 3 | Camino de Agua, Camino de Agua 2, Camino de Agua 3 |
| Sky Ride | Paseo por el Cielo |

The field commands said to monsters are done (templates): "¡{mon}, corta el árbol!", "¡{mon}, ilumina la cueva!", "¡{mon}, rompe la roca!", "¡{mon}, empuja la roca!", "¡{mon}, vamos a nadar!", "¡{mon}, llévame volando!", "¡{mon}, baja al fondo!", "¡{mon}, sube la cascada!".

### Monster types (`terms.type`)

fire **fuego**, water **agua**, grass **hierba** (not "planta"), electric **eléctrico**. Pattern: "{mon} es de tipo {type}." For other types in free text: hielo, roca, tierra, volador, fantasma, dragón, acero, veneno, bicho, normal, and **kungfú** (Kungfu), **mente** (Mind), **sombra** (Shadow).

### Battle phrases

| English | Spanish |
| --- | --- |
| battle | la batalla |
| Let's battle! | ¡A la batalla! |
| Let's battle again! | ¡Otra batalla! |
| I challenge you | Te reto a una batalla de monstruos. |
| X, your turn! | ¡{mon}, te toca! |
| use a move | usar un ataque (moves = ataques) |
| You beat me | ¡Me ganaste! |
| beat the master | gánale al Jefe de la Isla |
| heal | curar |
| wild monsters | monstruos salvajes |
| tall grass | la hierba alta |
| train | entrenar |
| give up | rendirse ("¡No te rindas!") |

## 5. Lines that mention English

The learner is learning **Spanish**, so English becomes **español**:

- "They will teach you English!" → "¡Te van a enseñar español!"
- "Monsters here listen to English" → "Aquí los monstruos escuchan español."
- "Your English is so clear!" → "¡Tu español es muy claro!"
- "English Champion" / "English Cup" → "la campeona de español" / "la Copa de Español".
- "What is this in English?" → "¿Cómo se dice esto en español?"

A school subject in a list is also switched ("Me gustan el español, las matemáticas y las ciencias."). The game swaps 英语 / English in the meaning line too. If a line only makes sense about English (spelling, English letters), drop the mention or talk about "las palabras".

## 6. Punctuation

- Always use paired **¿…?** and **¡…!** around the question or exclamation part: "Shh... ¡Esta vez ganaste tú!", "{name}, ¡dicen que…!".
- **Vocatives:** put the name inside the exclamation: "¡{mon}, te toca!", "¡Despierta, {mon}!", "¡Hola, {name}!".
- **Quotes:** use curly double quotes “…” (no escaping needed in JSON): 'Lee tu pase: “Me llamo {name}.”'.
- Ellipsis: three dots "..." (as in the source).
- Numbers: digits for coins and counters ("10 monedas", "(2/3)"). Spell out numbers that the learner has to say or hear as words ("Son las siete.", "quince de mayo").
- Onomatopoeia: parrot ¡Cruac!, bell ¡Din!, phone ¡Rin, rin!, ¡Tic, tac!, machine ¡Bip!, egg ¡Crac!, ¡Shh!, ¡Uy! (oops), ¡Guau! (wow).
- Capitals: proper names and the place / item names as they are written in `terms`. Common item nouns are lower case (poción, bicicleta).

## 7. Words in templates that your lines must match

Some templates **do not** carry their own translation of a free slot. The game then looks up the English value as a line, and **your** translation of that line fills the slot. Translate these lines in your batch; the result must also read well inside the template:

| Template (batch g) | Its slot is filled by your line(s) |
| --- | --- |
| "{x1} ¡Cruac!" (parrot gate, a-hello-crayon) | "Good morning!", "Good afternoon!", "Good evening!" |
| "Escucha otra vez: {x1}" / "¡Uy! {x1}" (Rainbow Crab) | "Walk on red!", "Walk on blue!", "Walk on yellow!". Use **"¡Camina sobre el rojo!" / "…el azul!" / "…el amarillo!"**, because the done-template says "¡Caminaste sobre el rojo!" |
| "Tim dijo: “{x1}”" (b-farm-school-lab) | Tim's descriptions ("My mom has long hair. She has a red dress." etc.) |
| "Mmm, escucha otra vez. Puedes decir: “{x1}”" (c-circus clubs) | the right answers "Yes, I can.", "Yes, it can.", "Sure! I love drawing." |
| "{x1} Escucha las pistas otra vez." (d-jungle-city) | "He doesn't have glasses.", "His cap is blue, not red.", "He doesn't have a bag." |

Values that batch g **already** translated (keep your own lines consistent with them):

- **Weather:** Sunny / Rainy / Windy / Snowy / Cloudy → **Sol / Lluvia / Viento / Nieve / Nubes**. The radio line "Sunny, then rainy, then windy." should be "Sol, luego lluvia, luego viento." The answer "Hace sol" is fine in normal questions.
- **Ordinals:** first / second / third → primero / segundo / tercero ("¿Qué libro va primero?").
- **Notes and instruments:** el tambor, el piano, la guitarra, la nota do / mi / sol.
- **Clock Island people:** el panadero (Baker Bun), la estudiante (Student Lucy), el alcalde (Mayor Tick).
- **Animals:** elefante, mono, jirafa, koala, tigre, panda, cebra, pingüino, león.
- **Foods:** la manzana, el brócoli, la banana, las papas fritas, la dona, los dulces, la hamburguesa; healthy food = comida sana, junk food = comida chatarra.
- **Spy clues:** "Lleva una gorra roja. Tiene lentes. Tiene una mochila en la espalda."
- **Memory cards:** went / saw / ate / bought / trip / beach → fui / vi / comí / compré / el viaje / la playa.
- **Family words:** mamá, papá, abuela, abuelo, hermano, hermana, la hermanita (little sister).

## 8. Traps

- **Good evening and Good night are both "¡Buenas noches!".** In the parrot gate the four options must still differ. Use ¡Buenos días! / ¡Buenas tardes! / ¡Buenas noches! for the three greetings. For the "Good night!" option use a different farewell, such as "¡Hasta mañana!". Check every question for the same problem: two English options can collapse into one Spanish phrase.
- **Grammar answers** ("Yes, I can." vs the wrong "Yes, I do." / "Yes, it is.") do not map one-to-one. Spanish answers repeat the verb: "Sí, sé cantar." / "Sí, puede bailar." Choose wrong options that are clearly wrong replies in Spanish (another topic or another person), not near-synonyms.
- **Ser / estar:** "¿Dónde está…?" and "Está en…" for location and state; "Es…" for what something is or its colour.
- Do not reuse the franchise's Spanish terms: no medalla, Líder de Gimnasio, Centro…, Alto Mando, Calle Victoria, MT/MO, Superpoción, Revivir, Repelente, Cuerda Huida, "¡Te elijo a ti!", "evoluciona", "se debilitó". Use: insignia, Jefe de la Isla, Parada de Descanso, Camino del Valor, caracola, "¡{mon} está creciendo!", "{mon} ya no puede seguir."

## 9. Decisions from the consistency pass (2026-11-21)

`tools/course/es/lines.json` is now the file of record. These decisions apply to the whole file.

| Term | Decision |
| --- | --- |
| Rainbow Crab (Isle Master, Crayon Island) | **el Cangrejo Arcoíris**. For masters named "title + animal", translate both parts: la abuela Tortuga, el entrenador **Foca** (Coach Seal; never "Seal"), el director Búho, el gallo Rex, el Dragón del Recuerdo. Real personal names stay: Polly, Octo, Flo, Puffy, Croc, Sharky, Whaley. |
| Tree Doctor | **el doctor Árbol** (place: Cabaña del Doctor Árbol) |
| Hush Stone | **la Piedra Silencio** / las Piedras Silencio (same family as Banda Silencio, Base Silencio) |
| Challenge Halls named by theme in lines (Timetable Hall, Traffic Hall, Birthday Hall, Music Hall, Weather Hall…) | Always **Sala + island word**: Sala Materias, **Sala Reglas** (not "Sala del Semáforo"), Sala Fiesta, Sala Música, Sala Clima. Hall puzzles keep their own names (Sendero de las Huellas). |
| Book Mountain (sign) | Montaña de Libros (place: Sendero de la Montaña de Libros) |
| stone tablets (Memory Temple) | **las placas** (Placa 1 … Placa 7); not "tablillas" |
| club sticker | **la calcomanía** (understood across Latin America) |
| dumplings | **las empanaditas** |
| basketball | **el básquetbol** (matches fútbol, voleibol in the course) |
| relay baton | avoid the object: "¡Te toca el relevo!", "fallaste el relevo", "hiciste un relevo perfecto" |
| password | **la contraseña** |
| Spring Festival / Mid-Autumn Festival | **la Fiesta de la Primavera** / **el Festival del Medio Otoño** |
| Beijing | **Pekín** |
| Whisper's note "— W" | **— S** (Susurro) |
| "Rumble…" as a sound (Memory Hall wall, Rumble's storm cry) | the verb **retumbar** (a pun on Retumbo): "Algo retumba…", "¡Retumba, retumba!"; never "Rum, rum" |
| "the boss" | Say who it is: la jefa (Whisper, in the Hush Base) / el señor Callado (the final boss). "Jefe" alone is only for Jefe de la Isla and "jefe de la clase". |
| I cannot battle now | **Ahora no puedo tener una batalla.** (not "batallar", not "hacer batalla") |
| dear (old ladies, Mom, caretakers) | **cariño**, or drop it. Not "cielo" or "mi vida". |
| the green-haired boy (Kai) | un chico de pelo verde |
| school subject "Chinese" | **el chino** (the meaning line still says 语文 / Chinese). "English" as a subject is **el español**. |
| kite | **la cometa** (not "papalote") |
| pie | **el pastel** (not "pay") |
| car | **el auto** / los autos (widely understood) |
| banana | Avoided. Use la fruta ("A los monos les gusta la fruta"). The food-floor template says "¡La fruta es comida sana!" under 🍌. |
| bin / trash can | **el basurero** ("Ponla en el basurero"); "Saca comida de la basura" |
| light bulb | avoid ("una lucecita", "su cola de luz") |
| pen | **el bolígrafo** (not "pluma", which also means feather) |
| bye-bye | ¡Adiós! (not "¡Chao!") |
| take photos | **sacar fotos** (as in the course) |
| gears | los engranajes |
| champion league / hero of the league | la Meseta de Campeones / el héroe de la Copa |
| Ready, steady, go! | ¡Preparados, listos, ya! |
| ¿A dónde…? | write **¿Adónde…?** |

**Question options.** Shared short answers have to fit every question they are used in:

- "Yes, I can." = **¡Sí, claro!** It is the right answer to "¿Puedes ayudarnos?", "¿Puedes ayudar al doctor Octo?" and the club's "¿Sabes cantar?".
- "Yes, I do." = Sí, me gusta. "Yes, it is." = Sí, lo es. "Yes, I am." = Sí, soy yo. "No, it isn't." = No, no es. "No, I don't." = No, gracias. These are all wrong options, and each one is clearly off-topic for every question that uses it.
- "Yes, there is." = Sí, hay una.

**Past-tense questions.** The wrong option keeps its grammar point (present instead of past) but gets a time word, so the two are clearly different when spoken:

| Right | Wrong |
| --- | --- |
| Tuvimos una batalla en la Ruta 1. | Todos los días tenemos una batalla en la Ruta 1. |
| Paré la máquina de nieve. | Todos los días paro la máquina de nieve. |
| Se comió todos los sonidos. | Ahora se come todos los sonidos. |
| Hablaron juntos. | Ahora hablan juntos. |
| Fui al museo. | Mañana voy al museo. |
| Dije: “¡Habla fuerte!” | Siempre digo: “¡Habla fuerte!” |

The radio-order options (Sol / Lluvia / Viento in different orders) stay as they are, because the order *is* the question, and the first word already differs.

**Gender-neutral phrasing that is now standard.**

- "¿Entrenas monstruos?" / "¿Tienes monstruos?" for "Are you a trainer?"
- "Te damos la bienvenida" / "Te doy la bienvenida" for "Welcome".
- "¡Gracias, joven!" for "Thank you, young trainer".
- "Yo siempre gano" for "I am the best trainer".
- "¡Estudias muy bien!" for "You are the best student".
- "¡Hoy vi a alguien muy fuerte!" for "I saw a strong trainer today".

**Handbook (dex.js).** Use two short sentences in the present tense, and start with the monster's English name (only Pinchy becomes **Pinzy**). Monster names are never translated, even when the story has a Spanish name for the same being: the monster Hushking stays "Hushking", while the legend's villain in the story is "el Rey del Silencio".

### Name tags, map words and buttons (`terms.person` / `sign` / `ui`, 2026-11-21)

- **Name tags (person):** the title comes first, with a capital letter, then the name unchanged.
  - Profesora Echo, Capitana Polly, Capitán Gale, Pescador Bob, Estudiante Amy, Tía Mary, Abuela Tortuga, Entrenador Foca, Director Búho, Gallo Rex, Doctor Árbol, Oficial Lee, Maestra Bell, Maestro Grey, Sr. Callado, Sra. Park, Dra. Skye.
  - The gender of each title comes from the character's `g` in the source.
  - A tag that would be identical in Spanish is left out, so the game shows the English: plain names such as Kai, Amy, Orion, Echodrake; the Isle Masters' own names Crabby, Croc, Sharky, Whaley, Puffy, Flo; and Fan Nora, Fan Toby, Fan Tony.
- **Gender-neutral titles where the gender is unknown or mixed:**
  - Guardabosques (Ranger)
  - Agente de tránsito (Traffic Officer)
  - Turista (Tourist)
  - Estudiante, Artista, Campista, Montañista (Hiker), Malabarista, Baterista (Drummer), Ayudante (Aide / Assistant), Cantante, Pianista
  - Banda Silencio (Hush Crew, whose members are both boys and girls)
- **Other tag decisions:**
  - Ace Trainer → Experto / Experta.
  - Admin Whisper → Susurro; Admin Rumble → Retumbo (names only).
  - Monk → **Sabio** (keeps religion out).
  - Club members → "Ken, club de arte", "Zoe, jefa del club".
  - Descriptive names → Ben de los bichos, Bob de los globos, Mia desordenada, Tom dormilón.
  - Talking objects → Pizarrón, Radio, Panel de control, Puerta del Recuerdo, Carta del Recuerdo, Máquina del clima, Interruptor del clima, Loro.
- **Map words (sign):**
  - Building signs: DESCANSO (Rest Stop), TIENDA (Shop), GIMNASIO (the GYM sign over the Challenge Hall door; the same word also labels a school gym in a cartoon background, so a challenge-only word would not fit there).
  - School floor tiles: BIBLIOTECA, COMEDOR, PASILLO, OFICINA, SALÓN, SALIDA, CÓMPUTO, LAB, MÚSICA. These are kept short because a long word shrinks or spills over the tile. The matching option lines use the same words.
  - Subject Hall tiles match the timetable lines: Matemáticas, Español, Ciencias, Arte, Ed. física, Chino, Historia, Geografía.
  - Memory Hall tiles match the memory-card template: fui, vi, comí, compré, el viaje, la playa.
- **Buttons (ui):** SÍ / NO, ¡Vamos!, Ahora no, Subir, ¡Gracias!, ¡Claro!, Otro día, ¡Apriétalo!, "Luz verde: ¡cruza!", "Luz roja: ¡alto!", ¡Enciéndelo!, Huevo, Caja, Muro de honor (keep this name; don't swap in the other series' name for a champions' wall).

## 10. Examples (tone and level)

| English | Spanish | Why |
| --- | --- | --- |
| Hi there! You must be {name}, my new neighbour! | ¡Hola! Tú eres {name}, ¿verdad? ¡Somos vecinos! | no gendered "vecino/a" |
| Now write your English name on it. | Ahora escribe tu nombre. | the English mention is dropped |
| My name is {name}. (speak) | Me llamo {name}. | course phrase |
| Then the guard will let you go north to Route 1. My child {rival} is there. | Luego el guardia te deja ir al norte, a la Ruta 1. Allí está {rival}. ¡Yo soy su mamá! | rival gender-free |
| I'm {rival}. I want to be the English Champion! | Soy {rival}. ¡Quiero ganar la Copa de Español! | gender-free, Spanish not English |
| Are you ready? Here it comes! | ¡Atención! ¡Ahí viene! | no listo/a |
| Red, yellow, blue and green. Colors, come back! (speak) | Rojo, amarillo, azul y verde. ¡Colores, vuelvan! | course words |
| It's seven o'clock. Time to get up! (speak) | Son las siete. ¡Hora de levantarse! | course clock phrase |
| Don't break the rules! (speak) | ¡Respeta las reglas! | positive imperative, A1 |
| Shh... go home, little trainer. | Shh... vuelve a tu casa. | "little trainer" is gendered, so it is dropped |
| Words make people fight. A quiet world is a happy world. | Las palabras hacen discutir a la gente. Un mundo callado es un mundo feliz. | "fight" means argue |
| Welcome back! | ¡Qué bueno verte otra vez! | no bienvenido/a |
| Hello! What is this in English? | ¡Hola! ¿Cómo se dice esto en español? | English becomes Spanish |
| Use a Quiet Spray, and wild monsters will not hear you. | Usa un Spray Silencio y los monstruos salvajes no te van a oír. | ir a + infinitive |
| Tickturtle, I am ready! (speak) | ¡Tickturtle, aquí estoy! | short, gender-free |
| You are a true Champion! Take this. | ¡Tú sí sabes ganar! Toma esto. | gender-free |

## 11. Side quests and Today's Sighting (round 2, 2026-11-21)

Two new files, contract in `tools/course/TALK.md` (second round, part A):

- **`quests.json`**: the 17 side quests of `quests.js` (`ask`, `note`, `opener`, the model sentence of each step, `words`, `thanks`, `bye`). The persona and the goal stay in English on the server, so every fact in a model sentence has to match the persona.
- **`sight.json`**: the 157 clue lines of `tools/course/sight-src.json`. The clues are built from half-sentences, and each English half-sentence has exactly one Spanish form (table below). When the templates in `sighting.js` change, translate the new half-sentence once and reuse it.

### Quest terms

| English | Spanish | Note |
| --- | --- | --- |
| the owner (of the cap) | el dueño | "¿De quién?" for *whose* |
| visitor | la visita | works for a man or a woman, as in the story lines |
| island greeter / "you will be the greeter" | recibir a las visitas: "Yo recibo a las visitas de la isla", "tú me recibes" | no noun, so nothing agrees with the player |
| my lines (what I have to say) | qué decir / lo que tengo que decir | |
| lost and found | objetos perdidos | as in the story lines |
| stationery store | la papelería | |
| eraser | la goma de borrar | as in the story lines |
| pencil box | el estuche | as in the story lines |
| the list | la lista | |
| duck / little pig | el pato / el cerdito | |
| windmill | el molino (de viento) | |
| farm gate, school gate | la puerta | same word as the puzzle gates |
| by the river | cerca del río | course phrase *cerca de* |
| next to / across from / behind | al lado de / enfrente de / detrás de | course phrases |
| classroom | el salón (de clases) | "el salón de inglés" in quest q3-way (see `review.md`) |
| on the second floor | en el segundo piso | as in the story lines |
| school sports day | el día del deporte | lower case; the Sports Island event keeps "Día del Deporte" |
| notice board | el tablero de avisos | |
| PE room | el cuarto de deportes | |
| a bad / better mark | una mala nota / una mejor nota (sacar una nota) | |
| maths club, art club | el club de matemáticas, el club de arte | |
| club show | la exposición del club | |
| come for tea / tea time | venir a tomar el té / la hora del té | |
| o'clock | en punto | "a las cuatro en punto" |
| surprise party / party bag | la fiesta sorpresa / la bolsa de fiesta | |
| noodles / beef noodles | los fideos / los fideos con carne | as in the story lines |
| bowls of / glasses of | tazones de / vasos de | |
| orange juice | el jugo de naranja | |
| food stall | el puesto de comida | *puesto* is a unit 4 word |
| Animal Park | Parque de Animales | as in the story lines |
| the river road | el camino del río | |
| mask (on Nightpaw's face) | la máscara | same word as Nightpaw's handbook line |
| bin | el basurero | |
| tree house | la casa del árbol; plural in the clues: casas en los árboles | |
| City Garden | el Jardín de la Ciudad | new |
| Snow Mountain | la Montaña de Nieve | new; same pattern as Campo de Nieve |
| weather report | el pronóstico | as in the story lines |
| the (weather) station | la Estación del Clima | `terms.place` |
| ice lake | el lago de hielo | as in the story lines |
| warm coat / gloves | el abrigo / los guantes | |
| photo album | el álbum de fotos | |
| fog | la niebla | |
| my old partner (a monster) | mi viejo compañero | |
| Mayor Tick, Coach Tom (inside a sentence) | el alcalde Tick, el entrenador Tom | lower-case title, as in §3 |

Gender-neutral wording used for the player in the quests:

- "You are a good trainer" → "Tú entrenas muy bien."
- "A good trainer should have it" / "a good trainer like you" / "for a brave trainer" → "Es para alguien que cuida bien a los monstruos." / "Necesita a alguien como tú." / "para alguien valiente".
- "You are a great greeter" → "¡Recibes muy bien a las visitas!"
- "A good planner / helper gets…" → "Quien planea bien recibe…" / "Quien ayuda bien recibe…"
- "You are good at this" / "good with time" → "Tú sabes hacer esto muy bien." / "Sabes organizar muy bien el tiempo."
- "You were polite" → "Fuiste muy amable"; "ask politely" → "pedir amablemente".
- "young trainer" → "joven"; "dear" → "cariño" (§9).
- The learner's own line "¡Bienvenido a Isla Hola!" keeps the masculine, because it is said to a known man (the visitor Finn).

Word cards (`words`): nouns carry their article, as in the course units (la gorra, los lápices). Verbs and phrases are written in the form the learner needs in this chat (sabes, almuerzas, fuiste, está comiendo). Sentence frames end in "…" like the unit words (voy a…, ¿Puedo…?, no…).

### Sighting clues: one form per half-sentence

| English | Spanish |
| --- | --- |
| It hides in the tall grass. | Se esconde en la hierba alta. |
| It hides in the cave. Walk around inside. | Se esconde en la cueva. Tienes que caminar por adentro. |
| It hides in the seaweed. | Se esconde en las algas. |
| It swims on top of the water. Ride on the water to find it. | Va nadando sobre el agua. Tienes que ir por el agua para encontrarlo. |
| It is a / an X monster. | Es un monstruo de tipo X. |
| It is blue. (any colour) | Es de color azul. (rojo, naranja, amarillo, verde, blanco, gris) |
| It is big. / It is very small. | Es grande. / Es muy pequeño. |
| It walks on four legs. / It stands on two legs. | Camina en cuatro patas. / Se para en dos patas. |
| It looks like a bird / a fish / a bug / a plant / a little ghost. | Parece un pájaro / un pez / un bicho / una planta / un fantasma pequeño. |
| It has a long body like a snake. | Tiene el cuerpo largo como una serpiente. |
| It has a shell on its back. | Tiene un caparazón en la espalda. (never "concha", §4) |
| It is round like a ball. | Es redondo como una pelota. |
| It is on an island. | Está en una isla. |
| There are A and B there. | Allí hay A y B. (", y" when A already has a "y") |
| People there … | Allí la gente … / Allí a la gente le encanta(n) … |
| It is on a road / on a sandy road / on a road by the sea / by a river / around the farms. | Está en un camino / en un camino de arena / en un camino junto al mar / junto a un río / alrededor de las granjas. |
| in the woods / on a beach / on a cliff by the sea / high on a mountain | en el bosque / en una playa / en un acantilado junto al mar / en lo alto de una montaña |
| in a field of snow / on a path in the jungle / in a tunnel | en un campo de nieve / en un sendero de la selva / en un túnel |
| in a cave / a dark cave / a cave of ice / a hot cave inside a mountain | en una cueva / una cueva oscura / una cueva de hielo / una cueva caliente dentro de una montaña |
| out at sea / under the sea | en el mar / bajo el mar |
| Go north (south, east, west) from the town. | Desde el pueblo, tienes que ir al norte (sur, este, oeste). |
| The way in is in the town. | La entrada está en el pueblo. |
| It is far from the town. | Está lejos del pueblo. |
| Walk through … first. / Walk along … first. / Climb a mountain first. | Primero tienes que pasar por … / caminar por … (seguir un camino) / subir una montaña. |
| Go out to sea and dive down. | Tienes que salir al mar y bajar al fondo. |

Instructions to the player use **tienes que + infinitive**, not the imperative. The tú imperative has the same form as "it does" (camina, pasa, sube), and the sentence before it is always about the monster, so "Camina por adentro. Camina en cuatro patas." would read as two facts about the monster.

Trees and houses in the island clue: palmeras; árboles como lápices grandes; árboles de otoño de color naranja; árboles redondos y verdes; árboles altos y delgados; pinos de color verde oscuro; árboles como dulces con palito (lollipops: no word works in every country); árboles grandes de la selva; árboles frutales; pinos con nieve. Casas blancas con techos rojos; casas de colores vivos; granjas con casas de madera; edificios de ladrillo rojo; casas redondas de vidrio; carpas grandes; torres de piedra con relojes; casas como pasteles; casas en los árboles; edificios altos; tiendas pequeñas; casas de madera con nieve en los techos.

### The 17 monster types in the clues

`terms.type` has four (fuego, agua, hierba, eléctrico). The other thirteen follow the list in §4, and the story line about lighting the cave now reads "un monstruo de tipo eléctrico, mente o fuego":

| Type | Spanish | Type | Spanish |
| --- | --- | --- | --- |
| Normal | normal | Flying | volador |
| Fire | fuego | Mind | mente |
| Water | agua | Bug | bicho |
| Grass | hierba | Rock | roca |
| Spark | eléctrico | Ghost | fantasma |
| Ice | hielo | Dragon | dragón |
| Kungfu | kungfú | Shadow | sombra |
| Poison | veneno | Steel | acero |
| Earth | tierra | | |

Decided by the lead on 2026-11-21: the game names these three types Kungfu, Mind and Shadow on purpose, so Spanish says **kungfú, mente, sombra** - never the type names another well-known monster series uses in Spanish. `sight.json` and the cave line in `lines.json` were changed to match.
