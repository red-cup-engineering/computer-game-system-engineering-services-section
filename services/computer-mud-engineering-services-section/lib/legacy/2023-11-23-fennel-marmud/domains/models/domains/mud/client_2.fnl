(local util (require :util))
(local client 
       (util.merge-models
        (util.load-model :gen/thing)
        {:name :Anonymouse
         :buffer ""
         :size 0}))

(fn client.chat [client channel message]
  (client.engine.talker:receive-message client channel mesage))

(fn client.login [client user]
  (client:message (.. "Logging you in as " user.id))
  (set client.user user)
  (set client.name (or user.name user.id))
  (each [relation relations (pairs user.relationships)]
    (local sys (. client.engine relation))
    (each [_ relationship (pairs relations)]
      (: sys (.. :setup- relationship) client)))
  (tset client.user.history (os.time {:event :login}))
  (client.engine.users:save-user client.user)
  (tset client.commands :login nil))

client
