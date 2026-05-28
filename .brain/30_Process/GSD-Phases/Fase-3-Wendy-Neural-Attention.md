---
layer: process
status: draft
runtime: true
owner: garik
links_to: [[../../20_Product/Subsystems/Wendy]], [[../../20_Product/Subsystems/RAG-Pipeline]], [[Fase-2-Cervello-Runtime]]
tags: [L3.5, process, gsd, wendy, neural-attention]
updated: 2026-05-28
---

# Fase 3 - Wendy Neural Attention

## Obiettivo
Rendere Wendy capace di scegliere cosa accendere in ogni turno: Brain interno, RAG mercato, memoria personale, Wendy Brain, tool e page context. Il sistema non allena un modello custom; aggiunge un layer persistente di attivazione, tracing e rinforzo edge.

## Componenti
- `wendy_neural_activations` - trace per request con `messageHash`, item attivato, score, componenti e flag `selected`.
- `wendy_neural_edges` - relazioni co-attivate con `weight`, `decayScore`, `evidenceCount` e status review-first.
- `buildWendyActivationContext` - costruisce la working memory del turno da fonti canoniche.
- `admin-qualita` - pannello minimo per ispezionare trace e approvare/archiviare edge candidati.

## Regole
- Non salvare messaggi completi, prompt completi, email, token o segreti.
- Le attivazioni sono segnali operativi, non verita.
- Nessuna scrittura automatica in `.brain` o memoria personale senza review.
- `WENDY_NEURAL_ENABLED=false` deve far tornare Wendy al comportamento precedente.

## Config
- `WENDY_NEURAL_ENABLED` - abilita/disabilita il layer.
- `WENDY_NEURAL_MAX_ITEMS` - numero massimo di item attivati nel prompt.
- `WENDY_NEURAL_EDGE_DECAY_DAYS` - finestra dopo cui gli edge non rinforzati decadono.
- `WENDY_NEURAL_MIN_EDGE_WEIGHT` - soglia sotto cui gli edge candidati vengono archiviati dal decay.
- `WENDY_NEURAL_DECAY_INTERVAL_MS` - frequenza del job server.

## Done
- Wendy include `activationSummary` negli eventi `done`.
- Fast path e full path ricevono la sezione `## Attivazione neurale Wendy`.
- Gli edge co-attivati vengono rinforzati dopo risposte riuscite.
- Il decay giornaliero indebolisce edge non rinforzati senza cancellare dati.
