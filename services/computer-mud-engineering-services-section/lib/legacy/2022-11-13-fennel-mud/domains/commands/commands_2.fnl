;;;; commands command

(local util (require :util))

(fn commands [client input]
  (client:message
   (.. "You have access to the following commands: "
       (util.quibble-strings client.command-list true))))
