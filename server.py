#!/usr/bin/env python
from livereload import Server, shell
server = Server()
server.watch('./')
server.serve(root='./', host='0.0.0.0')