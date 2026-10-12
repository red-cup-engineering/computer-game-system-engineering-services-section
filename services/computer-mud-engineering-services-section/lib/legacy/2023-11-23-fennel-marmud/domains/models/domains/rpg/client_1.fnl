(local util (require :util))
(local client (util.merge-models
               (util.clone-model :mud/client)
               {:relationships {:map :mud-client}}))

(fn client.look [client thing]
  (client:message (.. "You look at " (thing:fname))))

client
