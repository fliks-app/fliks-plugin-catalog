# Webhook notifications

Tells a service of yours when something happens in Fliks: a film or an episode finishes importing,
or a request is approved. Fliks posts the event to one HTTPS address you choose, as JSON.

It is the simplest way to plug Fliks into something you already run — a chat relay, a home
automation flow, a script of your own.

## Setting it up

Install it, then open its settings page and fill in **the endpoint URL**. Nothing is sent while
that field is empty, so an install on its own changes nothing.

The address must be HTTPS, and it must be reachable on the public internet: a target inside your
own network is refused, and that is re-checked on every delivery rather than only when you save it.

## What it does not do

- **One shot per event.** If your endpoint is down when an event fires, that event is lost — there
  is no retry and no queue. The separate *Notify* plugin exists for when delivery matters more
  than simplicity: it retries, absorbs bursts, and shows you what happened.
- **No filtering.** Both events are always sent; there is no per-event switch.
- **It holds nothing.** No credentials, no state, no database. Fliks itself makes the request.
