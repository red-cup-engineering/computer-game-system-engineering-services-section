;;;; MUDSocket client model

{:name "MUD client"
 :base :object
 :behaviors [:mud/client]
 :command-list [:chat :commands :help :login :look :move :quit :who :whoami]
 :buffer ""}
