function LibMapperModel ()
{
	this.devices = new Assoc();
	this.signals = new Assoc();
	this.links = new Assoc();
	this.connections = new Assoc();
	
	this.selectedConnections = new Assoc();
	

	this.networkInterfaces = {'selected': null, 'available': []};		
	
	// config items
	this.pathToImages = "images/";
};

LibMapperModel.prototype = {
		
		isConnected : function (src, dst)
		{
			var conn = this.getConnection(src, dst);
			if(conn)
				return true;
			return false;
		},
		getConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.connections.get(key);
		},
		hasSelectedConnections : function()
		{
			if(this.length>0)
				return true;
			else
				return false;
		},
		selectConnection : function (src, dst){
			var key = src + ">" + dst;
			var conn = this.connections.get(key);
			if(conn){
				this.selectedConnections = new Assoc();
				this.selectedConnections.add(key, conn);
			}				
		},
		isSelectedConnection : function (src, dst)
		{
			var key = src + ">" + dst;
			var conn = this.connections.get(key);
			if(conn)
				return true;
			else
				return false;
		},
		removeSelectedConnection : function(src, dst)
		{
			var key = src + ">" + dst;
			this.selectedConnections.remove(key);
		},
		
		
		
		
		isLinked : function (src, dst)
		{
			var link = this.getLink(src, dst);
			if(link)
				return true;
			return false;
		},
		getLink : function (src, dst)
		{
			var key = src + ">" + dst;
			return this.links.get(key);
		},
		
		// returns devices split into sources and destinations
		getDevices : function()
		{
			var srcDevs = new Array();
			var dstDevs = new Array();
			
			var keys = this.devices.keys();
			for (var d in keys) 
			{
				var k = keys[d];
				var dev = this.devices.get(k);
				
				if (dev.n_outputs)
					srcDevs.push(dev);
				if (dev.n_inputs)
					dstDevs.push(dev);
			}
			
			return [srcDevs, dstDevs];
		}
		
};