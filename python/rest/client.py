import requests


class Sportshub(object):

	def __init__(self, address):
		self.address = address

	def getUser(self, id=None):
		if id:
			r = requests.get('http://localhost:9090/rest/user/{0}'.format(id))
			if r.status_code == 200:
				print r.json()['user']
			elif r.status_code == 404:
				return None
			elif r.status_code == 500:
				raise ValueError('Server Error');
			
		else:
			r = requests.get('http://localhost:9090/rest/user')
			if r.status_code == 200:
				return r.json()['user']
			elif r.status_code == 404:
				return None
			elif r.status_code == 500:
				raise ValueError('Server Error');
				
