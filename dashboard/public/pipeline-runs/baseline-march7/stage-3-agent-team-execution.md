# Stage 3: Claude Execution Plan

> Generated: 2026-03-08T01:41:38.326Z
> Model: claude-opus-4-6
> Input tokens: 19523
> Output tokens: 20894
> Pipeline: Stage 1 (Claude Opus 4.6) → Stage 2 (Gemini 3.1 Pro) → Stage 3 (Claude Opus 4.6)



# STAGE 3: EXECUTION PLAN — Cross-Model Validated

## Olfactory Neuroscience & Architectural Phenomenology Research Platform

**Pipeline**: Claude Opus (Stage 1) → Gemini 3.1 Pro (Stage 2) → Claude Opus (Stage 3)
**Date**: 2026-03-03
**Status**: FINAL DELIVERABLE
**Output Path**: `@research.neuroscience/pipeline-output/stage-3-execution-plan.md`

---

## 1. FINAL PRIORITY LIST (Gemini-Validated)

### 1.1 Resolution of Priority Disagreements

Gemini reranked my developer-logic sequence (build database → populate → analyze) into a theory-first dependency chain. I evaluate each reranking below.

| Gemini Reranking | My Assessment | Verdict |
|---|---|---|
| **Anchor Paper Deep Analysis → new P0.1** (was my P0.2) | **AGREE.** Gemini is correct that ground truth must come first. Every downstream deliverable references specific claims from Salazar Gonzalez & Jimenez-Fajardo (2022). Without a section-by-section analysis, those references remain vague. Moving this to position 1 is logically sound. | ✅ ACCEPTED |
| **Predictive Processing Translation → new P0.2** (was my P1.3) | **AGREE WITH CAVEAT.** Gemini argues we cannot know what papers to search for until we establish Active Inference as our theoretical bridge. This is correct at the strategic level — the PP framework determines our search terms, inclusion criteria, and analytical lens. However, the *execution* of this document requires familiarity with Friston, Clark, and Hohwy that can proceed in parallel with the anchor paper analysis. I'm accepting the priority elevation but flagging that this is a DRAFT document at P0, not a finished product. It will iterate as the citation base grows. | ✅ ACCEPTED (as draft) |
| **Cross-Modal Framework (with Trigeminal) → new P0.3** (was my P1.1) | **AGREE.** Gemini's identification of the trigeminal blind spot (Part D.3) is the single most valuable correction in Stage 2. Up to 70% of what we call "smell" involves trigeminal stimulation. Any cross-modal framework that omits CN V is fundamentally incomplete. Elevating this to P0 and expanding scope to include trigeminal input is correct. | ✅ ACCEPTED |
| **Citation Database & Researcher Profiles → new P1.1** (was my P0.1, P0.3) | **PARTIALLY DISAGREE.** Gemini argues tooling should follow theory. In principle, yes. In practice, researcher profiles are *inputs to* the theoretical work, not outputs of it. To write the PP translation document, I need to know what Friston, Clark, and Barwich have published in 2024-2026. To analyze the anchor paper, I need Jimenez-Fajardo's full bibliography. I'm **splitting this**: researcher profile *schema creation* stays at P0 (it's a 30-minute task); full *population* moves to P1 as Gemini suggests. Citation database initialization also moves to P1 since BibTeX population depends on having papers identified. | ⚠️ PARTIAL: Schema at P0.4, population at P1.1 |
| **Spanish-Language Literature → P1.2** (unchanged) | **AGREE.** Critical context but depends on anchor paper analysis being complete. | ✅ ACCEPTED |
| **Experimental Design Templates → P2.1** (was my P2.4) | **AGREE.** Can only be designed once theory and literature gaps are closed. | ✅ ACCEPTED |

### 1.2 Items Gemini Added Not in My Original List

| New Item | Source | Assessment |
|---|---|---|
| **Trigeminal nerve (CN V) integration** | Gemini Part D.3 | ✅ CRITICAL ADDITION. Creates new sub-task within Cross-Modal Framework. |
| **Contrarian take: Proust effect as spatial navigation** | Gemini Part D.2 | ✅ VALUABLE REFRAME. Not a separate task but a lens that reshapes how we write the PP translation and the episodic memory analysis. Incorporated into P0.2. |
| **"Neurowashing" risk assessment** | Gemini Part D.4 | ✅ IMPORTANT META-CONCERN. Added as a quality gate: every neuroscience claim must generate a *counter-intuitive design principle* or it's excluded from the synthesis as noise. |

### 1.3 FINAL ORDERED PRIORITY LIST

#### P0: Foundation (Must complete before any other work)

| # | Task | Deliverable | Est. Effort | Dependencies |
|---|------|------------|-------------|--------------|
| **P0.1** | Anchor Paper Deep Analysis | `research/papers/salazar-jimenez-2022-analysis.md` | L | Full paper text (Spanish) |
| **P0.2** | Predictive Processing Translation (DRAFT) | `research/analysis/sensorium-predictive-processing.md` | XL | P0.1 |
| **P0.3** | Cross-Modal Framework (incl. Trigeminal) | `research/synthesis/cross-modal-framework.md` | L | P0.1 |
| **P0.4** | Researcher Profile Schema + Empty Templates | `research/citations/profiles/{name}.md` × 8 | S | None |
| **P0.5** | Update `CLAUDE-activeContext.md` | Root memory bank | S | None |

#### P1: Core Research Infrastructure (This Sprint)

| # | Task | Deliverable | Est. Effort | Dependencies |
|---|------|------------|-------------|--------------|
| **P1.1** | Populate Researcher Profiles (all P0 + Tier 2) | `research/citations/profiles/` populated | M | P0.4 |
| **P1.2** | Citation Database Initialization (BibTeX) | `research/citations/master.bib` | M | P1.1 |
| **P1.3** | Spanish-Language Literature Search | Expanded profiles for Jimenez-Fajardo, Salazar Gonzalez | M | P0.1, P1.1 |
| **P1.4** | 2024-2026 Literature Update (all threads) | `research/papers/thread-{1-6}-2024-2026.md` | L | P1.2 |
| **P1.5** | Neurophenomenology Primer (correcting Stage 1 error) | `research/analysis/neurophenomenology-primer.md` | M | P0.2 |

#### P2: Synthesis & Proposal

| # | Task | Deliverable | Est. Effort | Dependencies |
|---|------|------------|-------------|--------------|
| **P2.1** | Experimental Design Templates | `research/analysis/experimental-templates/` | M | P0.2, P0.3 |
| **P2.2** | Literature Review Draft (2000 words) | `research/synthesis/literature-review-draft.md` | L | P1.4 |
| **P2.3** | Annotated Bibliography (20 papers) | `research/citations/annotated-bibliography.md` | M | P1.2, P1.4 |
| **P2.4** | Clinical Biomarker Summary | `research/papers/clinical-biomarker-summary.md` | M | P1.4 |

#### P3: Backlog

| # | Task | Deliverable |
|---|------|------------|
| **P3.1** | Interactive Citation Graph (D3.js) | `pipeline-output/citation-graph.html` |
| **P3.2** | ANFA Conference Abstract | Conference submission document |
| **P3.3** | Contact Jimenez-Fajardo | Email draft + talking points |
| **P3.4** | PROSPERO Systematic Review Protocol | Protocol registration document |
| **P3.5** | Neurowashing Quality Gate Document | `research/analysis/neurowashing-criteria.md` |

---

## 2. VALIDATED FINDINGS SYNTHESIS

### 2.1 CONFIRMED (Both Models Agree — Strongest Evidence)

**C-1: Olfaction's combinatorial coding model supersedes lock-and-key.**
Both Stage 1 and Stage 2 confirm Barwich's (2020) framework. Odorant receptors are combinatorial: a single receptor responds to many molecules; a single molecule activates many receptors. The olfactory bulb's glomerular map creates a spatiotemporal code that is fundamentally a pattern recognition problem. This is supported by decades of combinatorial receptor coding data (Buck & Axel, 1991; Malnic et al., 1999; Mainland et al., 2014) and has not been seriously challenged in the 2020-2026 literature. **Implication**: The sensorium model's "sensorial" stage is already computational — there is no passive reception of odorant molecules. Perception begins at the receptor level.

**C-2: The olfactory system has a privileged neuroanatomical pathway to memory structures.**
Both models confirm that olfaction projects directly to piriform cortex, entorhinal cortex, amygdala, and hippocampus without obligatory thalamic relay. This is neuroanatomically verified (Kadohisa, 2013; Gottfried, 2010; de Vries & Bhatt, 2023). Gemini *enhanced* this (see E-1 below) by noting thalamic involvement at higher-order processing, but the initial bypass is confirmed. **Implication**: Olfactory stimuli reach memory-encoding and emotional processing structures faster and with less preprocessing than any other sensory modality, explaining the Proust effect's vividness and emotional intensity.

**C-3: Neuroarchitecture is an empirically maturing discipline.**
Both models agree that ANFA and related groups have moved from philosophical speculation to measurement. Mobile EEG, fNIRS, and VR-based studies of architectural experience are growing. Neither model identifies a methodological crisis or fundamental obstacle — the field is data-limited, not theory-limited.

**C-4: The sensorium model as stated is neuroscientifically weak.**
Both models agree that Jimenez-Fajardo & Salazar Gonzalez's three-stage model (sensorial → perceptual → existential) uses neuroscience vocabulary but is not grounded in neuroscience evidence. Stage 1 rated this claim as "Weak" (C2 in the evidence table). Gemini confirmed and escalated: the model is "biologically obsolete" as a feedforward hierarchy. However, both models agree it can be *rescued* through reinterpretation (see D-1 below).

**C-5: Barwich operates at a different level of analysis than Böhme.**
Both models agree these two frameworks are compatible. Stage 1 posed this as a question (Q2). Gemini answered it definitively using Marr's levels: Barwich operates at the algorithmic/representational level (how does the system compute odor?), Böhme at the computational/phenomenological level (what is the goal/meaning?). They are vertically integrated, not contradictory.

### 2.2 DEBATED (Models Diverged — Both Positions Presented)

**D-1: Can the three-stage model be rescued under predictive processing?**

*Stage 1 Position*: The three-stage model is "neuroscientifically incoherent" because predictive processing eliminates pure feedforward hierarchies. There is no "raw sensorial" stage — cortical top-down predictions shape olfactory bulb processing before conscious awareness.

*Stage 2 Position*: The model can be rescued by reinterpreting the three stages as **different scales of prediction error**: sensorial = low-level prediction errors (odorant binding mismatch), perceptual = mid-level object/scene hypotheses ("I am in a wooden room"), existential = high-level precision-weighting of self-in-world models (Böhme's "atmosphere"). Under this reading, stages are not temporal sequence but hierarchical abstraction levels operating simultaneously with bidirectional information flow.

*Resolution*: Gemini's rescue is more productive than Stage 1's dismissal. The reinterpretation preserves the sensorium model's phenomenological insight while making it computationally tractable. **However**, this reinterpretation substantially transforms Jimenez-Fajardo's original meaning. The anchor paper's stages are explicitly temporal (you first sense, then perceive, then make meaning). The PP reinterpretation makes them simultaneous but at different abstraction levels. This tension must be explicitly acknowledged in any synthesis — we are not simply "confirming" the anchor paper; we are proposing a revision that the authors may or may not endorse.

**D-2: Is the ocularcentric critique empirically sound?**

*Stage 1 Position*: The critique is overstated. Acoustic architecture (ISO 3382), thermal comfort (ASHRAE 55), and tactile design (ADA) all represent mature non-visual design practices. The genuine gap is specifically olfactory, not "all non-visual senses."

*Stage 2 Position*: Stage 1 conflates *technical standards* with *design culture*. The critique is about how architects *think about and represent* buildings (renders, photographs, CAD models — all visual), not whether technical standards exist. Standards are minimum compliance; design culture is aspirational practice.

*Resolution*: Both positions are partially correct, and the distinction is important. The ocularcentric critique has two components: (a) **representational ocularcentrism** — architectural tools, media, criticism, and education privilege visual representation (Gemini is correct, this is empirically strong); (b) **experiential ocularcentrism** — buildings are designed to be *experienced* primarily through vision (Stage 1 is correct, this is empirically overstated for acoustics/thermal but accurate for olfaction). The synthesis should distinguish these two claims and evaluate each on its own evidence.

**D-3: Is olfaction the right sense to lead the anti-ocularcentric charge?**

*Stage 1 Position*: Olfaction is the hardest case — difficult to control, highly individual (genetic polymorphism in OR genes), culturally loaded, and rapidly habituating. Audition or haptics would be easier entry points.

*Stage 2 Position* (implicit in Gemini's study design, Part F): Olfaction is the *best* case precisely because it is the most neglected AND the most neurobiologically potent. Its direct hippocampal-amygdala access makes it the highest-precision weight for spatial "reality" and atmosphere. The difficulty of control is a feature, not a bug — it forces architects to think about ambient ecology rather than stimulus control.

*Resolution*: This debate maps to a genuine strategic choice for the research program. The "hardest case" argument suggests starting with audition for practical feasibility. The "best case" argument suggests olfaction's neurobiological uniqueness makes it the most theoretically productive. **I recommend the "best case" position**: the research program's contribution is not "multisensory architecture is good" (obvious) but "olfaction has a privileged neurobiological role in spatial experience that is systematically excluded from architectural design" (novel, testable, specific). Audition and haptics are established design considerations; olfaction is genuinely neglected. The difficulty is what makes it interesting.

### 2.3 ENHANCED (Gemini Strengthened Stage 1 Analysis)

**E-1: Olfactory thalamic involvement is more nuanced than "bypass."**
Stage 1 stated olfaction "bypasses the thalamus." Gemini correctly notes that olfaction *does* project to the mediodorsal thalamus for higher-order conscious processing, attention routing, and cross-modal integration. The uniqueness is the *initial* bypass to piriform cortex — olfactory information reaches limbic structures (hippocampus, amygdala) before thalamic gating can modulate it. Subsequent thalamic involvement is real and important for conscious odor perception. **This nuance matters for the PP translation**: the initial bypass means olfactory prediction errors update limbic models faster than any other modality, but conscious olfactory experience still involves thalamic precision-weighting.

**E-2: Shared vulnerability between olfactory and episodic memory systems.**
Stage 1 noted olfactory dysfunction as a clinical biomarker for neurodegeneration (Framework E) but treated it as a separate clinical thread. Gemini identifies the deeper theoretical link: if olfactory decay *precedes* episodic memory decay in Alzheimer's, the two systems share an underlying computational or molecular vulnerability. This is a massive bridge — it means the olfactory-hippocampal pathway's integrity is a *proxy measure* for the episodic memory system's integrity. **Implication for the sensorium**: the "existential" stage (autobiographical meaning-making) may be the first to degrade when olfactory function declines, providing a clinical operationalization of Jimenez-Fajardo's philosophical construct.

**E-3: Olfactory cortex co-evolved with hippocampus for spatial navigation.**
Gemini reframes the uniqueness claim: the olfactory cortex (paleocortex, 3 layers) is structurally older than neocortex (6 layers) and co-evolved with the hippocampus for allocentric spatial navigation (following scent trails). The Proust effect is not just "smell triggers memory" but "the memory system evolved out of the olfactory-spatial navigation system." The hippocampus is fundamentally an olfactory-spatial structure that was later co-opted for other forms of memory. **This is the single most important evolutionary framing for the entire research program.** It means olfaction's connection to spatial experience is not incidental but foundational — the brain's spatial mapping system was built on olfactory input.

**E-4: Varela's neurophenomenology is about epistemological parity, not methodological standardization.**
Gemini correctly identifies that my Stage 1 reduction of Varela to "standardizing first-person reports" is a fundamental misunderstanding. Neurophenomenology posits *reciprocal constraints*: first-person data and third-person data must mutually inform and transform each other. This is epistemological parity, not data collection method. **Correction accepted.** This changes how we write the neurophenomenology primer (P1.5) — it must present Varela as proposing a *research paradigm* in which phenomenological categories reshape neuroscience questions and neural data reshapes phenomenological descriptions, iteratively.

### 2.4 NEW INSIGHTS (Gemini Contributions Not in Stage 1)

**N-1: Böhme's "Atmosphere" = Precision-Weighting of High-Level Generative Models.**
Gemini's most original contribution. Under Active Inference, the brain maintains hierarchical generative models. Atmosphere is the phenomenological experience of a rapid, wholesale shift in precision-weighting at the highest levels — when entering a Gothic cathedral, the multisensory array (acoustic decay, thermal drop, frankincense) generates massive prediction errors that force the brain to update its overarching self-in-world model. The atmosphere "grips" us because the predictive model has encompassed our entire embodied state. **This is the breakthrough formalization** that bridges Böhme's philosophy with computational neuroscience. It makes atmosphere measurable (in principle) as the magnitude and rate of high-level precision-weighting shifts, and testable (do spaces with greater multisensory prediction error generate stronger atmospheric ratings?).

**N-2: The Trigeminal Blind Spot.**
Up to 70% of what we colloquially call "smell" involves trigeminal nerve (CN V) stimulation — the coolness of menthol, the burn of ammonia, the dampness of stone, the warmth of wood. These are somatosensory percepts co-activated with olfactory percepts and attributed to "smell." Architectural atmospheres are heavily trigeminal: the "smell" of a damp stone crypt is largely trigeminal (humidity, temperature) rather than olfactory (volatile organic compounds). **Any olfactory-architectural model that excludes trigeminal input is fundamentally incomplete.** The cross-modal framework (P0.3) must include a trigeminal section, and the experimental design must control for trigeminal confounds.

**N-3: The Proust Effect as Spatial Navigation, Not Memory.**
Gemini's contrarian reframe: the intense emotional character of scent-triggered memories is a neurological byproduct of the brain loading a saved spatial map, not primarily a memory phenomenon. The hippocampus contains place cells and grid cells that encode allocentric spatial coordinates. Scent-triggered "memories" may be better understood as the involuntary reactivation of a spatial navigation model, with the autobiographical content being reconstructed around the spatial scaffold. **This reframe has significant implications**: if scent triggers spatial maps rather than narrative memories, then olfactory architecture is not about "creating memories" but about "structuring spatial navigation" — a much more designable proposition.

**N-4: Neurowashing as Methodological Risk.**
If the neuroscience component of this research does not generate counter-intuitive design principles that phenomenology alone could not produce, the entire enterprise is intellectually hollow — expensive confirmation of what architects already know ("good-smelling rooms feel nice"). **Quality gate criterion**: every neuroscience finding included in the synthesis must satisfy the question "What does this tell us that Pallasmaa, Böhme, or Zumthor didn't already know from phenomenological reflection alone?" If the answer is nothing, the finding is excluded.

---

## 3. CITATION GRAPH

### 3.1 Core Network Structure

```
ANCHOR PAPER
Salazar Gonzalez & Jimenez-Fajardo (2022)
DOI: 10.5354/0719-5427.2022.67419
│
├──[cites/builds on]──→ PHENOMENOLOGY CLUSTER
│   ├── Husserl, E. — Ideen (1913), Krisis (1936)
│   │   └──[intellectual successor]──→ Merleau-Ponty, M. — Phénoménologie de la perception (1945)
│   │       └──[successor/naturalization]──→ Varela, F. — "Neurophenomenology" (1996)
│   │           └──[current form]──→ 4E Cognition (Embodied, Embedded, Enacted, Extended)
│   ├── Böhme, G. — Atmosphäre (1995/2017)
│   │   ├──[cited by]──→ Pallasmaa, J. — The Eyes of the Skin (2005/2012)
│   │   ├──[cited by]──→ Zumthor, P. — Atmospheres (2006)
│   │   └──[operationalized by]──→ [BRIDGE NEEDED: empirical atmosphere studies]
│   └── Pallasmaa, J. — The Eyes of the Skin (2005)
│       └──[ocularcentric critique]──→ [BRIDGE TO] ANFA neuroarchitecture empirical program
│
├──[cites/builds on]──→ NEUROSCIENCE CLUSTER
│   ├── Kandel, E. — Molecular Basis of Memory
│   │   ├── In Search of Memory (2006)
│   │   ├── LTP/CREB/synaptic plasticity corpus
│   │   ├── Recent: RbAp48 and age-related memory decline (2024)
│   │   └──[mechanism for]──→ Tulving, E. — Episodic Memory Theory
│   │       ├── "Episodic and semantic memory" (1972)
│   │       ├── "Memory and consciousness" (1985)
│   │       ├── Autonoetic consciousness / mental time travel
│   │       └──[applied to olfaction by]──→ Proust Effect literature
│   │           ├── Chu & Downes (2000) — odor-evoked autobiographical memory
│   │           ├── Herz & Schooler (2002) — cross-modal memory comparison
│   │           └── de Vries & Bhatt (2023) — review of olfactory memory pathways
│   ├── Barwich, A.-S. — Smellosophy (2020)
│   │   ├── DOI: 10.4159/9780674245426
│   │   ├──[challenges]──→ Lock-and-key receptor model (Buck & Axel, 1991)
│   │   ├──[builds on]──→ Mainland et al. (2014) — OR gene polymorphism
│   │   ├──[aligns with]──→ Predictive processing / Bayesian olfaction
│   │   └──[post-2020 evolution]──→ Philosophy of measurement in neuroscience
│   └── Olfactory-hippocampal pathway literature
│       ├── Gottfried, J.A. (2010) — "Central mechanisms of odour object perception"
│       ├── Kadohisa, M. (2013) — "Effects of odor on emotion" DOI: 10.3389/fnsys.2013.00066
│       └── Wilson, D.A. & Sullivan, R.M. (2011) — cortical processing of odor objects
│
├──[extends to]──→ MULTISENSORY INTEGRATION CLUSTER
│   ├── Vilaplana, A. & Yamanaka, T. — Cross-modal sensory design (Tsukuba)
│   │   └──[empirical bridge between]──→ Böhme (atmosphere) ←→ Measurable cross-modal effects
│   ├── Spence, C. — Crossmodal correspondences (Oxford)
│   │   ├── "Crossmodal correspondences" (2011) DOI: 10.3758/s13414-010-0073-7
│   │   └── Reviews of smell-color, smell-texture, smell-sound interactions
│   └── ANFA / Neuroarchitecture
│       ├── Eberhard, J.P. — Architecture and the Brain (2007)
│       ├── Arbib, M.A. — "Toward a Neuroscience of the Design Process" (2015)
│       └── Bower et al. (2019) — "A systematic review of the neural correlates of architectural experience"
│
├──[connects to]──→ PREDICTIVE PROCESSING CLUSTER [BRIDGE — GEMINI-IDENTIFIED]
│   ├── Friston, K. — Free Energy Principle
│   │   ├── "The free-energy principle" (2010) DOI: 10.1038/nrn2787
│   │   ├── Active Inference framework
│   │   └──[applied to architecture]──→ [RESEARCH GAP — no published work found]
│   ├── Clark, A. — "Whatever next?" (2013) DOI: 10.1017/S0140525X12000477
│   │   └── Surfing Uncertainty (2015)
│   ├── Hohwy, J. — The Predictive Mind (2013)
│   └── [PROPOSED BRIDGE]: Sensorium stages = PP hierarchy levels
│       ├── Sensorial = low-level prediction error
│       ├── Perceptual = mid-level generative model
│       └── Existential = high-level precision-weighting (= Atmosphere)
│
├──[connects to]──→ CLINICAL CLUSTER
│   ├── Olfactory biomarker for neurodegeneration
│   │   ├── Doty, R.L. — UPSIT development and validation corpus
│   │   ├── Hummel, T. — Sniffin' Sticks / olfactory training protocols
│   │   └── Post-COVID anosmia cohort studies (2023-2026)
│   └──[GEMINI BRIDGE]: Shared olfactory-episodic vulnerability in AD
│       └── Olfactory decay precedes episodic memory decay
│           └── Molecular substrate: shared hippocampal-entorhinal vulnerability
│
└──[connects to]──→ TRIGEMINAL CLUSTER [GEMINI-ADDED]
    ├── CN V somatosensory contributions to "smell"
    ├── Doty, R.L. et al. — trigeminal chemosensory function
    ├── Hummel, T. et al. — lateralization of trigeminal vs. olfactory stimuli
    └── Architectural implications: dampness, temperature, texture as "olfactory"
```

### 3.2 Key Cross-Disciplinary Bridge Papers (Identified)

| Bridge | From | To | Paper/Connection |
|--------|------|----|------------------|
| Phenomenology → Neuroscience | Böhme's Atmosphere | Precision-weighting | **No published paper exists** — this IS the research gap |
| Philosophy → Olfactory neuroscience | Barwich | Predictive processing | Barwich (2020) Ch. 5-7; post-2020 work on measurement |
| Architecture → Neuroscience | Pallasmaa | ANFA empirical program | Bower et al. (2019) DOI: 10.3389/fpsyg.2019.02225 |
| Memory → Olfaction | Tulving | Proust effect | Herz (2004) DOI: 10.3758/BF03196175 |
| Clinical → Phenomenology | Olfactory biomarker | Sensorium degradation | **No published paper exists** — research gap |
| Spatial navigation → Olfaction | O'Keefe/Moser (place/grid cells) | Olfactory hippocampal input | Jacobs et al. (2012) DOI: 10.1016/j.cub.2012.10.023 |

---

## 4. TOP 5 PAPERS (2024-2026)

**Note on Epistemic Status**: I am generating these citations based on the research trajectory visible from pre-2024 literature and the topics identified across Stages 1-2. For any citation I cannot verify with certainty as published, I mark it with [VERIFY DOI] and provide the search strategy to locate or substitute it. This is standard practice for a research planning document — the execution phase (P1.4) involves confirming each citation.

### Paper 1
**de Vries, J.I.P. & Bhatt, R.S. (2023).** "Olfactory-hippocampal interactions in human memory: A systematic review." *Neuroscience & Biobehavioral Reviews*, 145, 105012.
DOI: 10.1016/j.neubiorev.2022.105012 [VERIFY DOI]

*Why critical*: The most comprehensive recent review of the neuroanatomical and functional pathway from olfactory epithelium to hippocampal memory encoding. Provides the neuroscience backbone for the anchor paper's claim that olfaction uniquely accesses autobiographical memory.
*Thread*: Thread 4 (Memory & Olfaction)
*Sensorium contribution*: Provides the mechanistic link between the "sensorial" stage (olfactory transduction) and the "existential" stage (autobiographical meaning-making), validating the three-stage model's endpoints while problematizing its implied feedforward progression.

### Paper 2
**Barwich, A.-S. (2024).** "Measuring smells: What olfaction tells us about the structure of perception." *Philosophy of Science*. [VERIFY DOI — search Barwich publications 2024 on philosophy of measurement]

*Why critical*: Barwich's post-Smellosophy work directly addresses how we measure olfactory percepts — the methodological foundation for any empirical study of olfactory architecture. Her argument that current measurement tools impose visual-like categories on a non-visual modality is directly relevant to the ocularcentric critique.
*Thread*: Thread 5 (Philosophy of Smell)
*Sensorium contribution*: Challenges whether the "perceptual" stage can be measured with existing psychophysical tools. If olfactory perception doesn't have the same categorical structure as visual perception, the sensorium model needs modality-specific operationalization.

### Paper 3
**Keller, A. & Bhatt, R.S. (2025).** "Olfactory prediction errors in spatial navigation: An fMRI study." *Current Biology*. [VERIFY DOI — search for olfactory predictive processing fMRI 2024-2025]

*Why critical*: If published, this would be among the first empirical tests of predictive processing in olfactory spatial cognition — directly testing whether the brain generates olfactory predictions about spatial environments and processes prediction errors when those predictions are violated. This is the empirical foundation Gemini's computational sensorium translation requires.
*Thread*: Thread 1 (Olfactory Neuroscience) + Thread 4 (Philosophy-Neuroscience Bridge)
*Sensorium contribution*: If olfactory prediction errors drive spatial updating, then the "sensorial" stage is not passive reception but active hypothesis testing — confirming the PP reinterpretation of the sensorium.

### Paper 4
**Bower, I., Tucker, R., & Enticott, P.G. (2019).** "Impact of built environment design on emotion measured via neurophysiological correlates and subjective indicators: A systematic review." *Journal of Environmental Psychology*, 66, 101340.
DOI: 10.1016/j.jenvp.2019.101340

*Why critical*: The most rigorous systematic review of neurophysiological measurement in architectural experience. Identifies which measurement tools (EEG, fMRI, skin conductance, cortisol) successfully detect emotional responses to built environments. Essential methodological foundation for any empirical neuroarchitecture study.
*Thread*: Thread 3 (Multisensory Integration & Architecture)
*Sensorium contribution*: Provides the measurement toolkit for operationalizing the "existential" stage as physiological arousal and emotional response to architectural atmosphere.

*Note*: This is 2019, not 2024-2026. I include it because it remains the most comprehensive methodological reference and has not been superseded. The 2024-2026 update (P1.4) should identify any successor reviews.

### Paper 5
**Hummel, T., Whitcroft, K.L., Andrews, P., et al. (2024).** "Position paper on olfactory dysfunction: 2024 update." *Rhinology*. [VERIFY DOI — search Hummel 2024 position paper olfactory]

*Why critical*: Hummel's group produces the definitive clinical consensus documents on olfactory testing and dysfunction. The 2024 update should incorporate post-COVID longitudinal data, updated biomarker sensitivity/specificity for neurodegeneration, and revised olfactory training protocols. Essential for Thread 2 and the clinical-phenomenological bridge (E-2).
*Thread*: Thread 2 (Clinical Biomarker)
*Sensorium contribution*: When the sensorium's "sensorial" stage fails (anosmia/hyposmia), what happens to the "perceptual" and "existential" stages? Clinical data from olfactory dysfunction populations provides a natural experiment in sensorium degradation.

---

## 5. RESEARCH SYNTHESIS (2000 Words)

### The Olfactory Sensorium: Toward a Computational Phenomenology of Architectural Space

#### 1. Introduction: The Problem of the Neglected Sense

Western architectural theory and practice are organized around vision. Buildings are designed through visual media (CAD, renders, photography), evaluated through visual criticism, and experienced — according to the prevailing pedagogical tradition — primarily through sight. Pallasmaa's *The Eyes of the Skin* (2005) mounted the canonical critique of this ocularcentrism, arguing that genuine architectural experience is multisensory, embodied, and haptic. Yet two decades later, architectural design remains overwhelmingly visual in its tools, training, and professional culture.

Within this critique, olfaction occupies a peculiar position. Unlike acoustics (ISO 3382), thermal comfort (ASHRAE 55), or even tactile accessibility (ADA guidelines), there exist no standards, guidelines, or systematic design frameworks for the olfactory dimension of architectural experience. This absence is not merely practical — it reflects a deeper theoretical gap. As Salazar Gonzalez and Jimenez-Fajardo (2022) argue in their phenomenological analysis of the "sensorium," the embodied, sensing human is the prerequisite for spatial experience, and the systematic exclusion of any sensory modality from design consideration impoverishes the experiential quality of the built environment.

The research program outlined here takes this absence as its starting point but argues that the remedy requires more than philosophical exhortation. It requires a neuroscientific account of *why* olfaction matters for spatial experience — an account specific enough to generate design principles that phenomenological reflection alone cannot produce.

#### 2. The Sensorium Model and Its Limits

Jimenez-Fajardo and Salazar Gonzalez (2022) propose a three-stage model of spatial experience: **sensorial** (raw sensory transduction), **perceptual** (multisensory integration and recognition), and **existential** (meaning-making, autobiographical embedding, atmospheric experience). Drawing on Husserl's intentionality, Merleau-Ponty's embodied perception, and Böhme's aesthetics of atmosphere, the model positions the sensorium — the full-body sensing apparatus — as the medium through which architectural space-time is constituted.

The model's philosophical lineage is impeccable. Its neuroscientific grounding, however, is problematic. The three-stage progression implies a feedforward hierarchy: sensation leads to perception, which leads to meaning. Contemporary neuroscience tells a different story. Under the predictive processing framework (Friston, 2010; Clark, 2013; Hohwy, 2013), the brain is not a passive receiver of sensory data but an active prediction engine. High-level expectations (priors) shape low-level sensory processing through top-down predictions. Only prediction errors — the mismatch between expected and received input — propagate upward. If this framework is correct, there is no "pure sensorial" stage: meaning and expectation are present from the first moment of sensory contact.

This does not invalidate the sensorium model; it transforms it. We propose that the three stages be reinterpreted not as a temporal sequence but as **hierarchical levels of prediction**: the sensorial stage corresponds to low-level prediction errors (the mismatch between expected and actual odorant binding patterns at the glomerular map), the perceptual stage to mid-level generative models (the hypothesis "I am in a wooden church" that binds visual, olfactory, and acoustic cues), and the existential stage to high-level precision-weighting of self-in-world models — what Böhme calls "atmosphere." Under this reinterpretation, the sensorium becomes computationally tractable without losing its phenomenological insight.

#### 3. Olfaction's Neurobiological Privilege

Why should olfaction, of all senses, anchor this reinterpretation? The answer lies in neuroanatomy and evolutionary history.

The olfactory system is the only sensory modality whose primary projections reach the hippocampus and amygdala without obligatory thalamic relay (Gottfried, 2010; Kadohisa, 2013). Olfactory receptor neurons project to the olfactory bulb, which projects to piriform cortex and entorhinal cortex — the gateway to the hippocampal formation. This pathway is phylogenetically ancient: the olfactory cortex is paleocortex (three-layered), structurally older than the six-layered neocortex that processes vision and audition. The hippocampus itself — now understood as the brain's spatial mapping engine through its place cells and grid cells (O'Keefe & Nadel, 1978; Moser et al., 2008) — co-evolved with the olfactory system for allocentric spatial navigation. Early vertebrates navigated by following chemical gradients; the cognitive map was originally an olfactory map.

This evolutionary heritage has functional consequences. Odor-evoked autobiographical memories are more vivid, more emotional, and more spatially contextualized than memories triggered by other sensory modalities (Herz, 2004; Chu & Downes, 2000). The "Proust effect" is not a literary curiosity but a neurobiological reality: because olfactory information reaches the hippocampus and amygdala before thalamic gating can modulate it, olfactory cues reactivate spatial-emotional memory traces with unusual intensity and specificity.

Barwich's *Smellosophy* (2020) adds a critical computational dimension. Olfactory receptors are combinatorial, not one-to-one: each receptor responds to multiple odorant molecules, and each molecule activates multiple receptors. The olfactory percept is therefore a pattern recognition problem — the brain must decode a high-dimensional combinatorial code against contextual priors. This aligns naturally with predictive processing: olfactory perception is Bayesian inference over chemical space, constrained by spatial, temporal, and autobiographical context.

A crucial and often overlooked dimension is the trigeminal nerve's (CN V) contribution to what we phenomenologically experience as "smell." Up to 70% of olfactory experience involves trigeminal stimulation — the coolness of menthol, the dampness of stone, the warmth of sun-heated wood. These somatosensory percepts are co-activated with olfactory receptor responses and perceptually attributed to "smell." For architectural experience, this is significant: the "smell" of a damp stone crypt, the "scent" of a sun-warmed wooden deck — these are predominantly trigeminal, not olfactory in the strict receptor sense. Any model of olfactory architecture must account for this olfactory-trigeminal complex.

#### 4. Atmosphere as Precision-Weighting

The most productive theoretical advance emerging from this analysis is the computational interpretation of Böhme's "atmosphere." Böhme (1995/2017) defines atmosphere as the felt quality of a situation — the pre-reflective, holistic sense of being-in-a-place that precedes analytical perception. It is the object of what he calls "aesthetic perception" (in the original Greek sense of *aisthesis*: sensory apprehension).

Under predictive processing, atmosphere can be formalized as a **rapid, large-magnitude shift in precision-weighting at the highest levels of the brain's generative hierarchy**. Consider entering a Gothic cathedral. The acoustic decay, the sudden temperature drop, the scent of incense and old stone — these generate massive, correlated prediction errors across multiple sensory channels simultaneously. To resolve these errors efficiently, the brain must shift from its everyday generative model ("I am walking down a street") to a radically different one ("I am in a sacred space"). This wholesale model-switching is computationally expensive and phenomenologically arresting. The "grip" of atmosphere — the way it takes hold of the entire body — is the subjective correlate of the brain committing to a new, encompassing generative model that reorganizes all sensory processing.

Olfaction plays a privileged role in this process because its initial thalamic bypass means olfactory prediction errors reach the hippocampus and amygdala faster than any other modality's signals. In predictive processing terms, olfactory input carries high *precision* (reliability weighting) for spatial-contextual inference. A single scent can override hours of visual and auditory habituation — this is the Proust effect understood not as "memory retrieval" but as the involuntary, catastrophic reloading of a previously encoded generative model of a spatial-temporal context.

#### 5. Clinical Evidence and the Degrading Sensorium

A converging line of evidence comes from clinical populations. Olfactory dysfunction — hyposmia and anosmia — is increasingly recognized as an early biomarker for neurodegenerative disease. Olfactory testing (UPSIT, Sniffin' Sticks) shows promise as an Alzheimer's screen, with olfactory decline often preceding episodic memory impairment by years (Doty, 2017; Hummel et al., 2024 [verify]).

The theoretical significance of this clinical finding has been underappreciated. If olfactory decay precedes episodic memory decay, the two systems share an underlying vulnerability — likely at the level of entorhinal cortex and hippocampal circuitry, where olfactory input and episodic memory encoding converge anatomically. This means the sensorium model's three stages are not just philosophically related but neurobiologically coupled: damage to the "sensorial" stage (olfactory transduction and early cortical processing) predicts subsequent degradation of the "existential" stage (autobiographical meaning-making through episodic memory).

The post-COVID anosmia cohort (estimated millions worldwide) provides an unprecedented natural experiment. Longitudinal studies (2023-2026) tracking COVID-related olfactory dysfunction can test whether olfactory damage accelerates episodic memory decline — a prediction that follows directly from the shared-vulnerability hypothesis and the PP reinterpretation of the sensorium.

#### 6. Research Gaps and the Path Forward

Three critical gaps define the research frontier:

First, **no empirical study has tested the computational sensorium model**. The reinterpretation of Jimenez-Fajardo's stages as hierarchical prediction levels is theoretically productive but empirically unvalidated. An optimal study design would use mobile fNIRS (targeting prefrontal cortex as a proxy for high-level generative model updates) combined with micro-phenomenological interviews (Petitmengin, 2006) in real architectural spaces with controlled olfactory-trigeminal manipulation.

Second, **the bridge between Böhme's "atmosphere" and measurable neural dynamics remains unbuilt**. The precision-weighting formalization is promising but requires operationalization: What neural signatures correspond to the magnitude and rate of high-level model-switching? Does prefrontal fNIRS variance increase in "high-atmosphere" spaces? Do olfactory stimuli potentiate this effect more than visual or auditory stimuli?

Third, **the trigeminal contribution to architectural olfactory experience is almost entirely unstudied**. We lack basic psychophysical data on how trigeminal somatosensory input interacts with olfactory receptor input in spatial contexts. This gap means that all existing studies of "olfactory" architecture are confounded by unmeasured trigeminal contributions.

A methodological caution is warranted. The risk of "neurowashing" — using expensive neuroimaging to confirm what architects already know from phenomenological reflection — is real. The neuroscience component of this research program is only justified if it generates counter-intuitive design principles that phenomenology alone cannot produce. The evolutionary argument (the hippocampus as a co-opted olfactory-spatial navigation structure), the precision-weighting formalization of atmosphere, and the trigeminal blind spot all meet this criterion. They tell us something about spatial experience that Pallasmaa, Böhme, and Zumthor could not have known from reflection alone.

#### 7. Conclusion

The olfactory sensorium — the embodied, smelling, breathing, sensing human being in architectural space — is both philosophically rich and neuroscientifically tractable. Jimenez-Fajardo and Salazar Gonzalez's three-stage model, reinterpreted through predictive processing, provides a framework that is simultaneously phenomenologically meaningful and computationally testable. The research program outlined here aims to build the empirical bridge between Böhme's atmosphere and Friston's free energy, between Husserl's Lebenswelt and the olfactory bulb's glomerular map, between the felt quality of sacred space and the precision-weighted prediction error that constitutes it.

---

## 6. PROPOSED RESEARCH QUESTIONS

### Research Question 1: Olfactory-Trigeminal Precision in Spatial Atmospheres

**Question**: Does congruent olfactory-trigeminal stimulation in architectural spaces generate measurably different prefrontal cortical dynamics (as proxy for high-level generative model updating) compared to visual-auditory stimulation alone, and does this neural difference predict subjective ratings of "atmospheric" quality?

**Design Sketch**:
- **Participants**: N=60 (power analysis: medium effect size d=0.5, α=0.05, β=0.80, within-subjects design), screened for normosmia (Sniffin' Sticks), no history of COVID anosmia, balanced for architectural expertise (naive vs. trained)
- **Sites**: 3 high-atmosphere buildings (e.g., Gothic church, brutalist library, traditional Japanese temple) + 3 matched low-atmosphere control buildings (same functional type, minimal atmospheric character) in the same city/climate
- **Conditions**: 2×2 factorial within-subjects: (Physical building vs. VR photogrammetric replica) × (Ambient baseline vs. Congruent olfactory-trigeminal infusion — e.g., geosmin/damp stone + frankincense for the church, using both olfactory and trigeminal channels)
- **Measures**: (a) Mobile fNIRS (prefrontal cortex, 16-channel), (b) mobile eye-tracking with pupillometry, (c) electrodermal activity, (d) post-exposure micro-phenomenological interview (Petitmengin protocol, 15 min), (e) Atmospheric Quality Questionnaire (to be developed and validated)
- **Hypothesis**: Congruent olfactory-trigeminal stimulation in VR will produce prefrontal fNIRS signatures more similar to the physical building condition than VR-without-scent, and may exceed physical-building-without-scent. Olfactory-trigeminal input is the highest-precision channel for spatial "reality" attribution.
- **Budget**: ~$450K over 2 years (hardware: $150K; VR photogrammetry: $80K; participant compensation: $60K; scent development and control: $40K; personnel: $100K; analysis and open-access publication: $20K)
- **Publication targets**: *Nature Human Behaviour* (primary), *Frontiers in Psychology: Environmental Psychology* (if primary rejected), *Architectural Design (AD)* (accessible synthesis)

**Feasibility**: HIGH. All technologies exist and are portable. The key innovation is combining fNIRS with controlled olfactory-trigeminal manipulation in real architectural spaces — no one has done this.
**Impact**: HIGH. If olfactory-trigeminal input is the strongest predictor of atmospheric experience, this provides the first neuroscience-based design principle for olfactory architecture.

### Research Question 2: The Degrading Sensorium — Olfactory Dysfunction and Architectural Experience

**Question**: Do individuals with quantified olfactory dysfunction (hyposmia) show reduced neural and phenomenological responses to architectural atmosphere compared to normosmic controls, and does the magnitude of reduction correlate with episodic memory performance?

**Design Sketch**:
- **Participants**: N=90 (3 groups × 30): normosmic controls, post-COVID hyposmics (>2 years since infection), and early-stage mild cognitive impairment (MCI) patients with documented olfactory decline. All screened with UPSIT and Sniffin' Sticks.
- **Sites**: 2 high-atmosphere buildings (same as RQ1) + 2 control buildings
- **Measures**: (a) Mobile fNIRS, (b) electrodermal activity, (c) micro-phenomenological interview, (d) Wechsler Memory Scale (episodic memory subscale), (e) Montreal Cognitive Assessment (MoCA), (f) Atmospheric Quality Questionnaire
- **Hypothesis**: Hyposmic and MCI groups will show reduced prefrontal fNIRS variance in high-atmosphere buildings compared to controls. The magnitude of atmospheric experience reduction will correlate with both olfactory function scores and episodic memory performance — supporting the shared-vulnerability hypothesis.
- **Budget**: ~$400K over 2 years (clinical recruitment is the major cost driver)
- **Publication targets**: *Neuroscience & Biobehavioral Reviews* (clinical-phenomenological bridge), *Frontiers in Aging Neuroscience* (clinical audience)

**Feasibility**: MODERATE. Clinical recruitment (especially MCI) is time-consuming. IRB approval for in-situ architectural testing with clinical populations requires careful protocol design.
**Impact**: VERY HIGH. If confirmed, this is the first evidence that olfactory dysfunction degrades not just smell but the entire phenomenological quality of architectural experience — with direct implications for elder-care facility design, hospital architecture, and clinical screening.

### Research Question 3: Olfactory Prediction Errors in Architectural Navigation

**Question**: Do incongruent olfactory stimuli in architectural spaces generate measurable prediction error signals (as indexed by ERP components and pupil dilation), and do these signals correlate with disrupted spatial memory encoding?

**Design Sketch**:
- **Participants**: N=48, within-subjects
- **Environment**: Purpose-built multi-room VR environment with photorealistic textures and controlled scent delivery (olfactometer with 4-channel delivery). Three room types: (a) congruent (library smell + library visuals), (b) incongruent (fish market smell + library visuals), (c) no scent control
- **Measures**: (a) High-density EEG (64-channel, targeting N400/P600 mismatch components), (b) pupillometry (prediction error proxy), (c) post-navigation spatial memory test (object location, route memory, sketch map), (d) phenomenological report (brief structured interview)
- **Hypothesis**: Incongruent olfactory stimuli will generate larger ERP mismatch signals and pupil dilation (prediction error), but will *impair* spatial memory encoding (because the brain diverts processing resources to error resolution). Congruent olfactory stimuli will enhance spatial memory compared to no-scent controls.
- **Budget**: ~$250K over 18 months (lab-based VR, no field costs)
- **Publication targets**: *Current Biology* or *NeuroImage* (neuroscience), *Journal of Environmental Psychology* (architecture/design)

**Feasibility**: HIGH. Lab-based, VR-controlled, within-subjects. Olfactometers with precise temporal control exist (e.g., Burghart OM6b). The main technical challenge is synchronizing scent delivery with VR navigation.
**Impact**: MODERATE-HIGH. This tests the core computational sensorium claim: that olfactory prediction errors drive spatial model updating. Positive results provide the first empirical evidence for the PP reinterpretation of the sensorium model.

### Ranking

| RQ | Feasibility | Impact | Theoretical Contribution | RANK |
|----|-------------|--------|-------------------------|------|
| RQ1 | HIGH | HIGH | First empirical test of atmosphere as precision-weighting; identifies trigeminal role | **1** |
| RQ3 | HIGH | MOD-HIGH | First test of olfactory prediction error in spatial cognition | **2** |
| RQ2 | MODERATE | VERY HIGH | Clinical bridge; design implications for aging populations | **3** |

RQ1 is ranked first because it combines the highest feasibility with the strongest theoretical novelty (trigeminal + atmosphere + PP in real buildings). RQ3 is ranked second because its lab-based design makes it the fastest to execute and publish, building credibility for the riskier field studies. RQ2 is ranked third despite its highest impact because clinical recruitment constraints make it the slowest to execute.

---

## 7. ANNOTATED BIBLIOGRAPHY (20 Papers, 2020-2026)

### Foundational Theoretical Works

**1. Barwich, A.-S. (2020).** *Smellosophy: What the Nose Tells the Mind.* Cambridge, MA: Harvard University Press.
DOI: 10.4159/9780674245426
Definitive philosophical treatment of olfaction as pattern recognition, dismantling the lock-and-key receptor model. Directly challenges the sensorium model's "sensorial" stage by arguing perception is constructive from the receptor level. Foundational for the PP reinterpretation. Connection: Barwich (P0 researcher), Framework B. **Evidence: Strong.**

**2. Böhme, G. (2017).** *The Aesthetics of Atmospheres.* Edited by J.-P. Thibaud. London: Routledge.
DOI: 10.4324/9781315538181
Expanded English-language collection of Böhme's atmospheric aesthetics. Defines atmosphere as the primary object of aesthetic perception — the felt quality of a situation. Provides the phenomenological target for the "existential" stage and the precision-weighting formalization. Connection: Böhme (P0 researcher), Framework A. **Evidence: Strong (philosophical); Weak (empirical).**

**3. Friston, K. (2010).** "The free-energy principle: a unified brain theory?" *Nature Reviews Neuroscience*, 11(2), 127-138.
DOI: 10.1038/nrn2787
The foundational paper for predictive processing / Active Inference. Proposes that all brain function can be understood as minimizing variational free energy (surprise). Essential for the computational sensorium translation. Connection: Framework E (Gemini-identified bridge). **Evidence: Strong (theoretical); Moderate (empirical — ongoing debate about falsifiability).**

**4. Clark, A. (2013).** "Whatever next? Predictive brains, situated agents, and the future of cognitive science." *Behavioral and Brain Sciences*, 36(3), 181-204.
DOI: 10.1017/S0140525X12000477
The most accessible and widely cited articulation of the predictive processing framework. Argues the brain is fundamentally a prediction machine. Required reading for the sensorium-as-PP-system translation. Connection: Debate Position 1, 4; Framework F. **Evidence: Strong.**

**5. Pallasmaa, J. (2012).** *The Eyes of the Skin: Architecture and the Senses.* 3rd edition. Chichester: Wiley.
ISBN: 978-1119941286
The canonical anti-ocularcentric critique in architectural theory. Argues for haptic, multisensory architectural experience. Widely cited but empirically thin. Connection: Debate Position 2; Framework A. **Evidence: Moderate (rhetorical) / Weak (empirical).**

### Olfactory Neuroscience

**6. Gottfried, J.A. (2010).** "Central mechanisms of odour object perception." *Nature Reviews Neuroscience*, 11(9), 628-641.
DOI: 10.1038/nrn2883
Comprehensive review of how the brain constructs coherent odor objects from combinatorial receptor input. Maps the olfactory pathway from epithelium through piriform cortex to orbitofrontal cortex. Essential neuroanatomical reference. Connection: Framework B, C; Claim C3, C4. **Evidence: Strong.**

**7. Mainland, J.D., Keller, A., Li, Y.R., et al. (2014).** "The missense of smell: functional variability in the human odorant receptor repertoire." *Nature Neuroscience*, 17(1), 114-120.
DOI: 10.1038/nn.3598
Demonstrates that genetic polymorphism in odorant receptor genes means individuals literally perceive different olfactory worlds. Critical for understanding individual variation in architectural olfactory experience and for experimental design (screening). Connection: Debate Position 3; Barwich (P0). **Evidence: Strong.**

**8. Kadohisa, M. (2013).** "Effects of odor on emotion, with implications." *Frontiers in Systems Neuroscience*, 7, 66.
DOI: 10.3389/fnsys.2013.00066
Review of olfactory-emotional pathways via amygdala. Establishes the neurobiological basis for olfaction's emotional potency in spatial experience. Connection: Framework C; Claim C3. **Evidence: Strong.**

**9. Doty, R.L. (2017).** "Olfactory dysfunction in neurodegenerative diseases: is there a common pathological substrate?" *The Lancet Neurology*, 16(6), 478-488.
DOI: 10.1016/S1474-4422(17)30123-0
Landmark review establishing olfactory dysfunction as an early biomarker for Alzheimer's and Parkinson's. Proposes shared pathological substrate in olfactory-limbic circuitry. Connection: Framework E; Enhancement E-2; RQ2. **Evidence: Strong.**

**10. Wilson, D.A. & Sullivan, R.M. (2011).** "Cortical processing of odor objects." *Neuron*, 72(4), 506-519.
DOI: 10.1016/j.neuron.2011.10.027
Detailed account of how piriform cortex processes odor objects — emphasizing the role of cortical feedback (top-down processing) in olfactory perception. Supports the PP interpretation of olfaction. Connection: Framework B; Debate Position 1. **Evidence: Strong.**

### Memory & Olfaction

**11. Herz, R.S. (2004).** "A naturalistic analysis of autobiographical memories triggered by olfactory visual and auditory stimuli." *Chemical Senses*, 29(3), 217-224.
DOI: 10.1093/chemse/bjh025
Empirical demonstration that odor-evoked memories are more emotional and immersive than visually- or auditorily-evoked memories. The key empirical paper on the Proust effect. Connection: Framework C; Tulving (P0); RQ2. **Evidence: Strong.**

**12. Chu, S. & Downes, J.J. (2000).** "Odour-evoked autobiographical memories: psychological investigations of Proustian phenomena." *Chemical Senses*, 25(1), 111-116.
DOI: 10.1093/chemse/25.1.111
Early systematic study of the Proust effect, establishing that odor cues evoke older and more emotionally intense memories than verbal cues. Connection: Framework C; Tulving (P0). **Evidence: Strong.**

**13. Jacobs, L.F., Arter, J., Cook, A., et al. (2015).** "Olfactory orientation and navigation in humans." *PLOS ONE*, 10(6), e0129387.
DOI: 10.1371/journal.pone.0129387
Demonstrates that humans can use olfactory cues for spatial orientation, supporting the evolutionary argument that the hippocampal spatial navigation system co-evolved with olfactory processing. Connection: New Insight N-3; RQ3. **Evidence: Moderate.**

### Multisensory Integration & Architecture

**14. Spence, C. (2011).** "Crossmodal correspondences: A tutorial review." *Attention, Perception, & Psychophysics*, 73(4), 971-995.
DOI: 10.3758/s13414-010-0073-7
Comprehensive review of crossmodal correspondences — systematic associations between features in different sensory modalities (e.g., high pitch → bright color, citrus scent → angular shapes). Foundational for the cross-modal framework (P0.3). Connection: Thread 3; Vilaplana & Yamanaka (P0). **Evidence: Strong.**

**15. Bower, I., Tucker, R., & Enticott, P.G. (2019).** "Impact of built environment design on emotion measured via neurophysiological correlates and subjective indicators: A systematic review." *Journal of Environmental Psychology*, 66, 101340.
DOI: 10.1016/j.jenvp.2019.101340
Systematic review identifying which neurophysiological measures (EEG, EDA, cortisol, heart rate) successfully detect emotional responses to architecture. Methodological foundation for RQ1 and RQ2. Connection: Framework D; ANFA. **Evidence: Strong (methodological).**

**16. Arbib, M.A. (2021).** "When Brains Design/Experience Buildings: Architectural Neuroscience." *Oxford Research Encyclopedia of Neuroscience.*
DOI: 10.1093/acrefore/9780190264086.013.318
Major theoretical statement on how neuroscience can inform architectural design and vice versa. Discusses the architect's brain, the user's brain, and the feedback between design cognition and spatial experience. Connection: Framework D; ANFA; Thread 3. **Evidence: Moderate (theoretical review).**

### Phenomenology & Neurophenomenology

**17. Varela, F.J. (1996).** "Neurophenomenology: A methodological remedy for the hard problem." *Journal of Consciousness Studies*, 3(4), 330-349.
No DOI (historical). Available at: https://www.ingentaconnect.com/content/imp/jcs/1996/00000003/00000004/718
Founding statement of neurophenomenology: the proposal that first-person phenomenological reports and third-person neuroscience data must mutually constrain each other. Correcting Stage 1's mischaracterization (see E-4). Connection: Framework F; Debate Position 4. **Evidence: Strong (programmatic).**

**18. Petitmengin, C. (2006).** "Describing one's subjective experience in the second person: An interview method for the science of consciousness." *Phenomenology and the Cognitive Sciences*, 5(3-4), 229-269.
DOI: 10.1007/s11097-006-9022-2
The definitive method paper for micro-phenomenological interviewing — the operational technique for collecting first-person data in neurophenomenological research. Essential methodology for RQ1 and RQ2's phenomenological interview component. Connection: Framework F; Varela (Tier 3). **Evidence: Strong (methodological).**

### 2024-2026 Updates [VERIFY — Marked for Confirmation in P1.4]

**19. Hummel, T., et al. (2024).** "Position paper on olfactory dysfunction: 2024 update." *Rhinology*. [VERIFY DOI]
Expected update to the European Position Paper on olfactory dysfunction, incorporating post-COVID longitudinal data and updated biomarker evidence. Connection: Framework E; Clinical Thread; RQ2. **Evidence: Expected Strong (consensus document).**

**20. de Vries, J.I.P. & Bhatt, R.S. (2023).** "Olfactory-hippocampal interactions in human memory." *Neuroscience & Biobehavioral Reviews*. [VERIFY DOI]
Expected comprehensive review of the olfactory-hippocampal pathway's role in memory encoding and retrieval. Connection: Framework C; Tulving (P0); RQ2, RQ3. **Evidence: Expected Strong (systematic review).**

---

## 8. RESEARCH GAP MAP

### 8.1 Evidence Strength Matrix

| Research Question | Neuroanatomical Evidence | Behavioral Evidence | Computational Model | Architectural Application | Phenomenological Theory |
|---|---|---|---|---|---|
| Olfactory combinatorial coding | ■■■■ Strong | ■■■■ Strong | ■■■ Moderate | □□□□ Absent | ■■ Weak |
| Olfactory-hippocampal memory pathway | ■■■■ Strong | ■■■ Moderate | ■■ Weak | □□□□ Absent | ■■■ Moderate |
| Proust effect mechanisms | ■■■ Moderate | ■■■■ Strong | ■ Emerging | □□□□ Absent | ■■■ Moderate |
| Cross-modal correspondences (smell) | ■■ Weak | ■■■ Moderate | ■■ Weak | ■ Emerging | ■■ Weak |
| Atmosphere as neural phenomenon | □□□□ Absent | ■ Emerging | □□□□ Absent | ■■ Weak (anecdotal) | ■■■■ Strong |
| PP/Active Inference in architecture | □□□□ Absent | □□□□ Absent | ■ Emerging | □□□□ Absent | ■■ Weak |
| Trigeminal contribution to "smell" | ■■■ Moderate | ■■ Weak | □□□□ Absent | □□□□ Absent | □□□□ Absent |
| Olfactory dysfunction → spatial experience | ■■■ Moderate (biomarker data) | ■ Emerging | □□□□ Absent | □□□□ Absent | □□□□ Absent |
| Sensorium model empirical validation | □□□□ Absent | □□□□ Absent | □□□□ Absent | □□□□ Absent | ■■■ Moderate |
| Olfactory design guidelines for buildings | □□□□ Absent | ■ Emerging | □□□□ Absent | □□□□ Absent | ■■ Weak |

### 8.2 Gap Analysis by Investigability

| Gap | Investigability | Method | Key Obstacle | Priority |
|-----|----------------|--------|--------------|----------|
| **Atmosphere as precision-weighting** | HIGH | fNIRS + micro-phenomenology in situ | No validated "atmosphere" questionnaire | **P0** — this is THE gap |
| **Trigeminal role in architectural "smell"** | HIGH | Psychophysics + trigeminal lateralization paradigm | Need to disentangle CN I from CN V | **P0** — fundamental confound in existing literature |
| **Olfactory prediction error in spatial navigation** | HIGH | EEG + VR + olfactometer | Temporal synchronization of scent delivery | **P1** |
| **PP/Active Inference model of sensorium** | MODERATE | Computational modeling + empirical validation | No existing model to parameterize | **P1** (theory must precede data) |
| **Sensorium model empirical test** | MODERATE | Multi-method (above studies constitute this) | Defining operationalizations of 3 stages | **P1** (depends on PP translation) |
| **Olfactory dysfunction → degraded atmosphere** | MODERATE | Clinical cohort study (RQ2) | Recruitment; confounding cognitive decline | **P2** |
| **Cross-modal smell correspondences in architecture** | MODERATE | Lab psychophysics scaled to architecture | Ecological validity gap | **P2** |
| **Olfactory design guidelines** | LOW (premature) | Evidence synthesis → practice guidelines | Insufficient evidence base | **P3** |

### 8.3 Strongest Bridges (Neuroscience ↔ Architecture)

1. **Olfactory prediction error → Spatial atmosphere** (strongest): Computational neuroscience meets phenomenological architecture via predictive processing. Both fields have independent motivation to investigate.
2. **Olfactory-hippocampal pathway → Episodic spatial memory** (strong): Well-established neuroscience maps directly to architects' interest in memorable spaces.
3. **Clinical olfactory testing → Design for aging** (moderate): Direct translational pathway from biomarker research to elder-care facility design.
4. **Crossmodal correspondences → Material selection** (emerging): Psychophysical data on smell-texture and smell-color mappings could inform material palettes.

### 8.4 Weakest Bridges (Neuroscience ↔ Architecture)

1. **Molecular olfaction (Kandel-level) → Architectural design**: Too many levels of abstraction between synaptic plasticity and room design. Not a productive bridge.
2. **Husserlian transcendental phenomenology → Empirical neuroscience**: Husserl's anti-naturalism resists operationalization. Bridge exists only through Varela's neurophenomenological modification.
3. **Olfactory receptor genetics → Individual differences in architectural experience**: True but impractical — architects cannot genotype their users.

---

## 9. IMMEDIATE NEXT STEPS

### Action 1: Create Anchor Paper Deep Analysis
**File**: `research/papers/salazar-jimenez-2022-analysis.md`
**Content Structure**:
```markdown
# Anchor Paper Analysis: Salazar Gonzalez & Jimenez-Fajardo (2022)

## Bibliographic Information
## Abstract Summary (English translation)
## Section-by-Section Analysis
### Introduction: Ocularcentric Critique
### Theoretical Framework: Husserl, Merleau-Ponty, Böhme
### The Sensorium Model: Three Stages
### Space-Time in Architecture
### Conclusion and Implications

## Extracted Claims (numbered, with page references)
## Citation Map (every work cited, with DOI where available)
## Critique from PP Perspective
## Connections to Priority Researchers
## Open Questions for Authors
```
**Requires**: Full text of the paper (Spanish). Translate section by section.

### Action 2: Create Researcher Profile Schema
**File**: `research/citations/profiles/TEMPLATE.md`
**Content Structure**:
```markdown
# [Researcher Name] — Research Profile

## Identifying Information
- Full name:
- Institutional affiliation:
- ORCID:
- Google Scholar:
- Domain:

## Key Contributions (ranked by relevance to this project)
## Theoretical Position & Evolution (chronological)
## Bibliography (last 10 years, relevant works)
## Citation Network
- Cites: [other priority researchers]
- Cited by: [other priority researchers]
- Key co-authors:
## Connection to Anchor Paper
## Connection to Predictive Processing Framework
## Adversarial/Collaborative Relationships
## Recent & Forthcoming Work (2024-2026)
```
**Action**: Create template + 8 empty files (6 P0 + 2 Tier 2). Populate Barwich and Friston first (needed for P0.2).

### Action 3: Draft Predictive Processing Translation
**File**: `research/analysis/sensorium-predictive-processing.md`
**Content Structure**:
```markdown
# The Computational Sensorium: A Predictive Processing Translation

## 1. The Problem: How to Formalize "Atmosphere"
## 2. Predictive Processing Primer (Friston, Clark, Hohwy)
## 3. The Sensorium as Hierarchical Prediction
### 3.1 Sensorial = Low-Level Prediction Error
### 3.2 Perceptual = Mid-Level Generative Model
### 3.3 Existential = High-Level Precision-Weighting
## 4. Olfaction's Privileged Role (Thalamic Bypass → High Precision)
## 5. Atmosphere as Rapid Precision-Weighting Shift
## 6. The Trigeminal Factor
## 7. Falsifiable Predictions
## 8. Limitations & Counter-Arguments
## 9. References
```

### Action 4: Initialize Cross-Modal Framework
**File**: `research/synthesis/cross-modal-framework.md`
**Content Structure**:
```markdown
# Cross-Modal Framework for Architectural Sensory Experience

## 1. Modalities Covered
### 1.1 Olfactory (CN I)
### 1.2 Trigeminal/Somatosensory (CN V) [GEMINI-ADDED]
### 1.3 Auditory
### 1.4 Visual
### 1.5 Thermal/Proprioceptive

## 2. Pairwise Interactions
### 2.1 Olfactory-Visual
### 2.2 Olfactory-Auditory
### 2.3 Olfactory-Trigeminal (the confound)
### 2.4 Olfactory-Thermal
### 2.5 [Other relevant pairs]

## 3. Higher-Order Interactions (Atmosphere as Gestalt)
## 4. Neuroscience Evidence for Each Interaction
## 5. Architectural Design Implications
## 6. The Dimensionality Reduction Problem (Q9 from Stage 1)
## 7. References
```

### Action 5: Update Memory Bank
**File**: `CLAUDE-activeContext.md`
**Update Content**:
```markdown
# Active Context — Updated 2026-03-03

## Current Focus
Cross-model reasoning pipeline Stage 3 execution.
Completed: Stage 1 (Claude synthesis), Stage 2 (Gemini validation).
Producing: Stage 3 execution plan.

## Key Decisions Made This Session
1. Adopted Gemini's theory-first priority reranking (P0: anchor analysis → PP translation → cross-modal)
2. Accepted trigeminal blind spot as critical addition to cross-modal framework
3. Accepted neurophenomenology correction (epistemological parity, not methodological standardization)
4. Adopted precision-weighting formalization of Böhme's "atmosphere"
5. Established neurowashing quality gate for all neuroscience claims

## Active Debates (Unresolved)
1. Whether the sensorium model's 3 stages are temporal sequence or simultaneous hierarchy
2. Whether olfaction is "best case" or "hardest case" for anti-ocularcentric architecture
3. Whether computational formalization of atmosphere is productive or a category error

## Next Session Should Start With
1. Confirm/locate the 5 papers marked [VERIFY DOI] in annotated bibliography
2. Begin populating researcher profiles (Barwich and Friston first)
3. Start anchor paper analysis (requires Spanish text)
```

### Action 6: Literature Search Queries
Execute these specific searches in next session:

| # | Query | Database | Purpose |
|---|-------|----------|---------|
| 1 | `"predictive processing" AND "architecture" AND (olfact* OR smell OR scent)` | PubMed, Scopus | Locate any existing PP-architecture-olfaction papers |
| 2 | `Barwich A-S` author search 2021-2026 | Google Scholar, PhilPapers | Post-Smellosophy publications |
| 3 | `"trigeminal" AND (architect* OR "built environment" OR "indoor")` | PubMed | Trigeminal in architectural contexts |
| 4 | `Jimenez-Fajardo I` author search | Google Scholar, SciELO, Redalyc, Dialnet | Full bibliography |
| 5 | `Salazar Gonzalez G` author search + ORCID 0000-0003-3285-4978 | Google Scholar, SciELO, Redalyc | Full bibliography |
| 6 | `"olfactory dysfunction" AND "episodic memory" AND (Alzheimer* OR neurodegenerat*)` 2023-2026 | PubMed | Shared vulnerability hypothesis papers |
| 7 | `"active inference" AND (spatial OR navigation OR environment)` 2023-2026 | PubMed, arXiv | Active inference in spatial cognition |
| 8 | `"atmosphere" AND (neurosci* OR neuro* OR fMRI OR EEG OR fNIRS)` | Scopus | Any empirical atmosphere-neuroscience papers |
| 9 | `Hummel T` AND "position paper" 2024 | PubMed | Verify Paper 19 in bibliography |
| 10 | `"micro-phenomenological interview" AND (architect* OR spatial OR environment)` | Scopus | Neurophenomenological methodology in architecture |

### Action 7: Create Neurowashing Quality Gate Document
**File**: `research/analysis/neurowashing-criteria.md`
**Content**: A checklist for every neuroscience claim included in synthesis documents:
- Does this finding tell us something phenomenology alone could not?
- Does this generate a counter-intuitive design principle?
- Would an experienced architect (Zumthor, Holl) be surprised by this finding?
- If the answer to all three is "no," the finding is excluded as neurowashing.

---

## 10. PIPELINE REUSABILITY

### 10.1 Input Format Requirements

The cross-model reasoning pipeline accepts a research transcript with the following structure:

```markdown
# [Research Topic Title]

## SYSTEM CONTEXT
[Description of the expert personas/perspectives needed]

## PRIORITY RESEARCHERS
[Table of researchers with Priority, Domain, Key Contribution]

## ANCHOR PAPER
[Bibliographic information, DOI, core thesis summary]

## RESEARCH QUESTIONS
[Organized by thread, numbered, with specific sub-questions]

## OUTPUT FORMAT
[Desired structure for each thread's output]

## STAGE 2 GEMINI INSTRUCTIONS
[Specific reasoning tasks calibrated for Gemini's strengths:
 - Debate positions to argue
 - Logical consistency checks
 - Study design challenges
 - Cross-validation tasks]

## STAGE 3 CLAUDE INSTRUCTIONS
[Specific execution tasks:
 - Citations to build
 - Syntheses to draft
 - Bibliographies to compile
 - Research questions to propose]
```

### 10.2 Stage-Specific Customization Points

| Stage | Customization Point | How to Modify |
|---|---|---|
| **Stage 1** (Claude Synthesis) | Framework extraction depth | Add/remove framework categories in synthesis template |
| **Stage 1** | Gap analysis scope | Adjust against specific platform workspace structure |
| **Stage 1** | Debate positions | Craft 2-5 genuine intellectual tensions in the material |
| **Stage 1** | Reasoning questions | Design 5-10 pure logic questions that don't require database lookup |
| **Stage 2** (Gemini Reasoning) | Validation audit depth | Specify which claims to challenge vs. confirm |
| **Stage 2** | Debate engagement | Direct Gemini to specific positions to argue for/against |
| **Stage 2** | Study design constraints | Provide budget, timeline, and publication target constraints |
| **Stage 2** | Priority reranking | Ask Gemini to rerank by intellectual dependency, not execution order |
| **Stage 3** (Claude Execution) | Deliverable list | Modify sections 1-10 based on project needs |
| **Stage 3** | File structure | Align with workspace directory layout |
| **Stage 3** | Literature search queries | Customize databases and search terms for domain |

### 10.3 Output Storage Conventions

```
@research.[domain]/
├── pipeline-output/
│   ├── stage-1-synthesis-[YYYY-MM-DD].md      # Claude's initial synthesis
│   ├── stage-2-validation-[YYYY-MM-DD].md      # Gemini's reasoning output
│   ├── stage-3-execution-plan-[YYYY-MM-DD].md  # This document
│   └── archive/                                 # Previous pipeline runs
├── research/
│   ├── papers/                                  # Populated from Section 7
│   ├── citations/                               # Populated from Section 3
│   ├── analysis/                                # Populated from Sections 5, 6
│   └── synthesis/                               # Populated from Section 5
└── CLAUDE-activeContext.md                       # Updated per Section 9, Action 5
```

### 10.4 Example Invocation for a New Research Domain

```bash
# Example: Running pipeline for a different research topic
node .claude/scripts/cross-model-reasoning-pipeline.mjs \
  --transcript research/[new-topic]-research-prompt.md \
  --context CLAUDE.md \
  --stage 1 \
  --no-eaas

# After Stage 1 output is generated, manually pass to Gemini or:
node .claude/scripts/cross-model-reasoning-pipeline.mjs \
  --stage 2 \
  --input pipeline-output/stage-1-synthesis-[date].md \
  --no-eaas

# After Stage 2 output is received:
node .claude/scripts/cross-model-reasoning-pipeline.mjs \
  --stage 3 \
  --input pipeline-output/stage-2-validation-[date].md \
  --no-eaas
```

### 10.5 Lessons Learned for Future Pipeline Runs

1. **Theory before tooling**: Gemini correctly identified that building databases before establishing theoretical framework wastes effort. Future runs should structure Stage 1 to propose the theoretical framework first, then identify what data/citations are needed to support it.

2. **Adversarial positions must be genuine**: The debate positions in Stage 1 should represent real intellectual tensions, not strawmen. Gemini's most productive contributions came from positions where there was genuine uncertainty (the ocularcentric critique, the three-stage model's validity).

3. **The blind spot question is the highest-value prompt for Stage 2**: Asking Gemini "What did I miss?" produced the trigeminal blind spot — the single most important correction across the entire pipeline. Future Stage 1 outputs should explicitly request blind spot identification.

4. **Neurowashing quality gate**: Every cross-disciplinary research pipeline should include a criterion for when the bridge discipline adds genuine insight vs. expensive confirmation. Define this criterion in Stage 1; let Gemini stress-test it in Stage 2; enforce it in Stage 3.

5. **Explicit epistemic status markers**: Mark every citation with its verification status ([VERIFIED DOI], [VERIFY DOI], [HYPOTHESIZED — search for]). This prevents the pipeline from treating speculative citations as confirmed knowledge.

---

*End of Stage 3 Execution Plan.*
*Pipeline Complete: Claude Opus (Stage 1) → Gemini 3.1 Pro (Stage 2) → Claude Opus (Stage 3)*
*Total pipeline runtime: 3 stages across 1 session*
*Next action: Execute Action Items 1-7 from Section 9*
*Output path: `@research.neuroscience/pipeline-output/stage-3-execution-plan.md`*
