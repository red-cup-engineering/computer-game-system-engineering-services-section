(local ips {:projects (require :projects)
            :timesheet (require :timesheet)
            :util (require :util)})

(fn ips.load [ips]
  (ips.projects:load)
  (ips.timesheet:load))

(ips:load)

ips
