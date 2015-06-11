// http://stackoverflow.com/questions/10692100/invoke-a-callback-at-the-end-of-a-transition
// https://groups.google.com/forum/#!msg/d3-js/WC_7Xi6VV50/j1HK0vIWI-EJ
function endall(transition, callback) {
	if (transition.length === 0) { callback() }
	var n = 0;
	transition
		.each(function() { ++n; })
		.each("end", function() { if (!--n) callback.apply(this, arguments); });
}


// define the graph object
function hieterGraph() {
	var self = this;

	self.width = 960;
	self.height = 500;

	self.doAnnotations = true;
	// A few options for annotation position
	self.annotationHeight = 250;
	self.annotationWidth = 300;
	self.annotationPositions = [{x: 150, y: 150}, {x:self.width - self.annotationWidth-50, y: self.height - self.annotationHeight - 50}];

	self.yearsMargin = {top: 30, right: 20, bottom: 30, left: 50};
	self.yearsWidth = self.width *3/4 - self.yearsMargin.left - self.yearsMargin.right;
	self.yearsHeight = 110 - self.yearsMargin.top - self.yearsMargin.bottom;

	self.yearsXScale = d3.time.scale().range([0, self.yearsWidth]);
	self.yearsYScale = d3.scale.linear().range([self.yearsHeight, 0]);

	self.svg;
	self.group;
	self.node;
	self.link;
	self.lsScl;

	self.legend;

	self.yearTextDisplay;

	// Line chart:
	self.yearsSvg;
	self.yearsSvgDefs;
	self.yearsClipPath;
	self.yearsCurrYearVerticalLine;

	self.annotation1Div;

	self.totalPapersBeforeLimiting;
	self.maxNodes = 100;

	self.egoID = 37801893;
	self.egoNode = {pID: self.egoID,
			Year: 1999,
			EF: 8.91211e-07,
			cluster: "12:32:18",
			DomainID: "4",
			fixed: true,
			x: self.width/2,  // Position in center
			y: self.height/2};

	self.allNodes;
	self.allLinks;
	self.currNodes;
	self.currLinks;
	self.currYear;


	// Colors
	// See http://colorbrewer2.org/?type=qualitative&scheme=Accent&n=5
	self.colorScheme = ['rgb(127,201,127)','rgb(190,174,212)','rgb(253,192,134)','rgb(255,255,153)','rgb(56,108,176)'];

	self.clusters = [{'cluster': '2', 'title': 'Immunobiology', 'color': self.colorScheme[1], 'alreadyAnnotated': false},
			{'cluster': '28', 'title': 'Cancer and Genetics', 'color': self.colorScheme[0], 'alreadyAnnotated': false}];
//	self.clusters = {'28': {'title': 'Cancer and Genetics', 'color': self.colorScheme[0]},
//			'2': {'title': 'Immunobiology', 'color': self.colorScheme[1]}};
	self.clustersToAnnotate = []
	for (var i=0; i < self.clusters.length; i++) {
		self.clustersToAnnotate.push(self.clusters[i].cluster);
	}

	// Scale for sizing nodes by Eigenfactor.
	// Defined in graphInit
	self.eigenFactorScale;

	self.timer;

	// Variables for line chart
	self.yearsFrequencyData;
	self.yearInit;  // This is the year before the ego node paper was published.
			// It is calculated in init().
	
	// Functions to switch back and forth between time format and string
	self.yearToStr = d3.time.format("%Y");  // Parse a D3 year into a simple year string
	self.strToYear = self.yearToStr.parse;  // Parse a year into D3 time format

	self.xAxis;
	self.yAxis;
	self.line;
	self.area;
	self.yearsFrequencyLine;
	self.yearsFrequencyArea;

	// Animation timing
	self.transitionTimePerYear = 5000;

	self.tick = self.makeTick();
	self.force = self.makeForce();
	//self.zoom = self.makeZoom();
	//self.drag = self.makeDrag();

	self.moveEgoNodeToFront = function() {
		// Move the ego node to the front:
		for (var i=0; i<self.allNodes.length; i++) {
			if ( self.allNodes[i].pID === self.egoID ) {
				self.allNodes.splice(0, 0, self.allNodes.splice(i, 1)[0]);
				break;
			}
		}
	}

	self.advanceYear = function() {
		self.currYear++;
		self.updateNodesAndLinks();
		self.updateLineChart();
		console.log(self.currYear);
		if (self.currYear >= d3.max(self.allNodes, function(d) { return d.Year; }))
			{console.log('goto finish'); 
			self.finishAnimation();}
	}

	self.finishAnimation = function() {
		//self.stopIntervalTimer();
		if (self.timer) clearInterval(self.timer);
		window.clearInterval(self.timer);
		self.timer = 0;
		d3.selectAll('#speedUpButton,#pauseButton,#stopButton')
			.on('click',null)
			.style('pointer-events', 'none')
			.transition().duration(1000)
			.style('opacity', .4);
		
		// Enable disconnect button.
		d3.select('#disconnectButton').on('click', self.disconnectEgoNode)
			.style('pointer-events', 'auto')
			.transition().duration(1000)
			.style('opacity', 1);
		d3.selectAll('.node').transition().delay(1000)
			.duration(self.transitionTimePerYear*2)
			.style('opacity', .9);
		d3.selectAll('.toEgo').transition().delay(1000)
			.duration(self.transitionTimePerYear*2)
			.style('opacity', .9);
		d3.selectAll('.notToEgo').transition().delay(1000)
			.duration(self.transitionTimePerYear*2)
			.style('opacity', .2);
	}

	self.disconnectEgoNode = function() {
		console.log('click');
		//var egoNodeIndex = self.currNodes.filter(function(n) {
		//				return n.pID===self.egoID;})[0];
		//egoNodeIndex = egoNodeIndex.index
		//console.log(egoNodeIndex);
		d3.select('#disconnectButton')
			.on('click', null)
			.style('pointer-events', 'none')
			.transition().duration(1000)
			.style('opacity', .4);
		var egoNodeIndex = 0;

		var retractDuration = 500;
		d3.selectAll('.link')
			.filter(function(d) {return d.target.pID === self.egoID; })
			.transition()
			.duration(retractDuration)
			.attr('x2', function(d) { return d.source.x; })
			.attr('y2', function(d) { return d.source.y; })
			.call(endall, disconnect);

		function disconnect() {
			// remove the ego node
			self.allNodes.splice(egoNodeIndex, 1);
			self.allLinks = self.allLinks.filter(function(d) { return d.target.pID != self.egoID; });
			self.node.data(self.allNodes).exit().remove();
			self.link.data(self.allLinks).exit().remove();
			// Let the force happen
			d3.selectAll('.node').each(function(d) { d.fixed = false; });
			// remove these classes from nodes and links so that
			// updateNodesAndLinks() doesn't affect their opacity
			self.svg.selectAll('.node,.link').classed('visible', false).classed('hidden', false);

			self.updateNodesAndLinks();

			self.svg.selectAll('.node').style('opacity', .9);
			self.svg.selectAll('.link').style('opacity', .2);

			// Call force.start again so that the force will continue to run
			self.force.start();
		}
	}

	// Repeatedly call advanceYear on a timer
	self.startIntervalTimer = function() {
		setTimeout(function() {
			clearInterval(self.timer);
			self.timer = window.setInterval(function() {
				self.advanceYear()
			}, self.transitionTimePerYear);
		});
	};

	// todo: deprecate this
	self.stopIntervalTimer = function() {
		if (self.timer) clearInterval(self.timer);
		self.timer = 0;
	};

	
	self.init();

	

	return self;

}

hieterGraph.prototype.init = function() {
	var self = this;



	self.svg = d3.select('#graphDiv').append('svg')
			.attr('id', 'graphSvg')
			.attr('width', self.width)
			.attr('height', self.height);
			
	// Put up initial annotation
	if (self.doAnnotations) self.annotation1();

	self.group = self.svg.append('g');
	self.link = self.group.append('svg:g')
			.attr('class', 'links')
			.selectAll('.link');
	self.node = self.group.append('svg:g')
			.attr('class', 'nodes')
			.selectAll('.node');
	
	self.yearTextDisplay = self.svg.append('svg:text')
			.attr('x', self.width * 8/9)
			.attr('y', self.height * 12/13)
			.attr('dy', '-.3em')
			.attr('font-size', '10em')
			.attr('text-anchor', 'end')
			.style('pointer-events', 'none')
			.style('opacity', 1e-9);

	
	d3.tsv('hieterNodes.tsv', function(nodes) {

		self.allNodes = nodes;
		self.allNodes.forEach(function(d) {
			// Convert strings to numbers
			d.pID = + d.pID;
			d.Year = +d.Year;
		});
		self.allNodes = self.allNodes.filter(function(d) { return d.Year != 0; });


		self.totalPapersBeforeLimiting = self.allNodes.length
		self.makeDescription();

		self.limitData();
		// sort by Year
		self.allNodes.sort(function(a,b) { return a.Year - b.Year; });
		// Move ego node back to front if the year sort screwed it up
		self.moveEgoNodeToFront();
		
		// Add special properties to the ego node:
		self.allNodes[0].fixed = true;
		// position in center
		self.allNodes[0].x = self.width/2;
		self.allNodes[0].y = self.height/2;
		console.log(self.allNodes);


		// Prepare data for the line chart:
		// Group by year and give counts of nodes
		var yearsNest = d3.nest()
			.key(function(d) { return d.Year; }).sortKeys(d3.ascending)
			.rollup(function(leaves) { return leaves.length; })
			.entries(self.allNodes)
			.filter(function(d) { return d.key >= self.egoNode.Year; });
		self.yearsFrequencyData = [];
		// Set yearInit as the year before the ego paper was published
		self.yearInit = d3.min(yearsNest, function(d) { return d.key; });
		self.yearInit = self.strToYear(self.yearInit);
		self.yearInit = d3.time.year.offset(self.yearInit, -1);

		// Populate the yearsFrequencyData array
		self.yearsFrequencyData.push({key: self.yearInit, values: 0});
		yearsNest.forEach(function(d) {
			var year = self.strToYear(d.key);
			self.yearsFrequencyData.push({key: year, values: d.values});
		});

		self.currYear = self.egoNode.Year-1;

		// Initialize the line chart:
		self.lineChartInit();


		// Load data for links:
		d3.tsv('hieterLinks.tsv', function(links) {
			self.allLinks = [];
			links.forEach(function(e) {
				// Convert strings to numbers
				e.source = +e.source;
				e.target = +e.target;

				// populate allLinks
				var sourceNode = self.allNodes.filter(function(n) { return n.pID === e.source; })[0];
				var targetNode = self.allNodes.filter(function(n) { return n.pID === e.target; })[0];
				if (sourceNode && targetNode) {
					self.allLinks.push({source: sourceNode, target: targetNode});
				}
			});

			// Start with just ego node:
			self.currNodes = [self.egoNode];
			self.currLinks = [];



			// Data loaded, now we can begin:
			//

			//self.lsScl = d3.scale.linear().range([1,.3]).domain(d3.extent(self.allNodes, function(d) {return d.Year;}));
			//self.lsScl = d3.scale.pow().exponent(80).range([1,.0001]).domain(d3.extent(self.allNodes, function(d) {return d.Year;}));
			self.lsScl = d3.scale.linear().range([1,.1]).domain(d3.extent(self.allNodes, function(d) {return d.Year;}));

			self.ldScl = d3.scale.linear().domain(d3.extent(self.allNodes, function(d) {return d.Year;})).range([0,200]);

			self.addEventListeners();

			self.graphInit();
			//d3.selectAll('.node').attr('r', function(d) {
			//	return 4.5 + (eigenFactorScale(d.EF) * 10);
			//})
			self.legendInit();


			//self.updateNodesAndLinks();

			// Repeatedly call advanceYear on a timer
			self.startIntervalTimer();



		});
	});

};

hieterGraph.prototype.limitData = function() {
	var self = this;

	// Remove some of the low Eigenfactor nodes


	// Start by randomizing the order of all the nodes
	d3.shuffle(self.allNodes);

	// order descending by Eigenfactor
	self.allNodes.sort(function(a,b) { return b.EF - a.EF; });
	
	// Move the ego node to the front:
	self.moveEgoNodeToFront();

	// Take the first n items, where n = maxNodes
	self.allNodes = self.allNodes.slice(0, self.maxNodes);

};

hieterGraph.prototype.addEventListeners = function() {
	var self = this;

	var pauseButtonClicked = function() {
		var $pauseButton = $('#pauseButton');
		if ( $pauseButton.hasClass('clicked') )
		{$pauseButton.removeClass('clicked')
			.html('Pause');
		self.startIntervalTimer(); }
		else
		{$pauseButton.addClass('clicked')
			.html('Resume');
		console.log(self.timer);
		if (self.timer) clearInterval(self.timer);
		self.timer = 0; }
	};

	// Add event listeners to buttons:
	d3.select('#yearButton').on('click', self.advanceYear);

	d3.select('#disconnectButton').style('pointer-events', 'none');

	d3.select('#pauseButton').on('click', pauseButtonClicked);
	
	d3.select('#speedUpButton').on('click', function() {
		self.transitionTimePerYear = 150;
		self.doAnnotations = false; // Turn off annotations
		if (self.timer) clearInterval(self.timer);
		self.timer = 0;
		d3.selectAll('.legendItem')
			.transition().delay(1000).duration(2000)
			.style('opacity', 1);
		self.startIntervalTimer();
	});

	d3.select('#stopButton').on('click', function() { if (self.timer) clearInterval(self.timer); self.timer=0; });

	d3.select('#reloadButton').on('click', function() { window.location.reload(true); });
};


hieterGraph.prototype.graphInit = function() {
	var self = this;

	// add graph properties
	self.force.nodes(self.allNodes);
	
	// update node elements
	self.node = self.node.data(self.allNodes, function(d) { return d.pID; });
	//self.node.exit().remove();
	var newNode = self.node.enter();
	

	newNode = newNode.append('svg:circle')
		.attr('class', 'node hidden')
		// Start with the node invisible
		.attr('r',1e-9)
		// Color by different categories of how similar the node's cluster is to the ego node
		.attr('fill', function(d) {
			var clusterSplit = d.cluster.split(':');
			// Color ego node
			if (d.pID==self.egoID) {return self.colorScheme[4];}
			// Color nodes with top-level cluster 28
			else if (clusterSplit[0] == '28') {
				return self.colorScheme[0];}
			// Color nodes with top-level cluster 2
			else if (clusterSplit[0] == '2') {
				 return self.colorScheme[1];}
			// Color nodes in the same cluster as the ego node
			else if (clusterSplit.slice(0,-1).join('') === self.egoNode.cluster.split(':').slice(0,-1).join('')) {
				return self.colorScheme[4];}
			// Color all other nodes
			else {return self.colorScheme[2];}
		})
		.style('opacity', .9);
	newNode.call(self.force.drag);

	// update link elements
	if (self.allLinks) {self.force.links(self.allLinks);}
	else{self.force.links();}

	self.link = self.link.data(self.allLinks);
	//self.link.exit().remove();
	var newLink = self.link
		.enter()
		.append('svg:line')
		.attr('class', function(d) {
		       if (d.target.pID === self.egoID) { return 'link hidden toEgo'; }
			else { return 'link hidden notToEgo'; }
		})		
		//.style('visibility', 'hidden')
		// Links to the ego node are darker than links between the others
		.style('opacity', function(d) {
			if (d.target.pID === self.egoID) { return .9; }
			else { return .2; }
		});
	


	self.force.start();
	// Execute force a bit, then stop
	for (var i = 0; i<1000; ++i) self.force.tick();
	self.force.stop();
	newNode.each(function(d) { d.fixed = true; });

	// Set up a scale for Eigenfactor in order to encode size of nodes by Eigenfactor (influence)
	var eigenFactorMax = d3.max(self.allNodes, function(d) {return d.EF; });
	self.eigenFactorScale = d3.scale.linear()
		.domain([0, eigenFactorMax])
		.range([0, 1]);

	// Reveal ego node
	d3.selectAll('.node').filter(function(d) { return d.pID === self.egoID; })
		.classed('hidden', false)
		.classed('visible', true)
		.transition()
		.duration(1000)
		.attr('r', function(d) {
			return 4.5 + (self.eigenFactorScale(d.EF) * 10);
		})
		.each('end', function() {
			// reveal legend
			self.legend.transition()
				.delay(4000)
				.duration(1000)
				.style('opacity', 1);
		});

};

hieterGraph.prototype.updateNodesAndLinks = function() {
	var self = this;

	//var newNodes = [];
	var newNodes = d3.selectAll('.node')
			.filter(function(d) { return d.Year === self.currYear && d.pID != self.egoID; })
			// sort so that larger nodes tend to appear first
			// (this somewhat reduces the problem of sending out 
			// links to nodes that haven't appeared yet.
			// maybe try a better solution later.)
			.sort(function(a, b) { return d3.descending(a.EF, b.EF); });
	var newLinks = d3.selectAll('.link')
			.filter(function(d) { return d.source.Year === self.currYear; });
	console.log(newNodes);
	console.log(newLinks);

	// find current index in allNodes (don't include ego node)
	for (var i=1; i<self.allNodes.length; i++) {
		if (self.allNodes[i].Year === self.currYear)
			{var currIndex = i;
			break;}
	}

	if (self.currYear >= self.egoNode.Year) {

		self.yearTextDisplay.text(self.currYear);
		if (self.currYear == self.egoNode.Year) 
			{self.yearTextDisplay.transition()
				.duration(1000)
				.style('opacity', .15);
	}



		//self.allLinks.forEach(function(e) {
		//	var sourceNode = newNodes.filter(function(n) { return n.pID === e.source; })[0];
		//	var targetNode = self.currNodes.filter(function(n) { return n.pID === e.target; })[0];
		//	if (sourceNode && targetNode) {
		//		self.currLinks.push({source: sourceNode, target: targetNode});
		//	}
		//});
	}



	// Fade nodes from previous years
	d3.selectAll('.node.visible').filter(function(d) {return d.pID != self.egoID; })
		.transition().delay(500).duration(1000).style('opacity', .5);

	// Fade links from previous years
	d3.selectAll('.visible.toEgo').transition().delay(500).duration(1000).style('opacity', .4);
	d3.selectAll('.visible.notToEgo').transition().delay(500).duration(1000).style('opacity', .1);

	var timePerNode = newNodes[0].length ? self.transitionTimePerYear / newNodes[0].length : 0;
	var nodeAppearDuration = timePerNode * 2;
	console.log(newNodes.length);
	console.log(timePerNode);
	console.log(nodeAppearDuration);
	
	// This function will draw the link out from the source to the target.
	// We'll call it after each node appears.
	function drawLinks(links) {
	links
		.attr('x2', function(d) { return d.source.x; })
		.attr('y2', function(d) { return d.source.y; })
		.style('visibility', 'visible')
		.transition()
		.delay(0)
		.duration(nodeAppearDuration)
		.attr('x2', function(d) { return d.target.x; })
		.attr('y2', function(d) { return d.target.y; });
	}

	// Make the nodes appear:
	newNodes.classed('hidden', false)
		.classed('visible', true)
		.transition()
		//.delay(function(d, i) { return (i-currIndex) * timePerNode; })
		.delay(function(d, i) { return i * timePerNode; })
		.duration(nodeAppearDuration)
		.attr('r', function(d) {
			return 4.5 + (self.eigenFactorScale(d.EF) * 10);
		})
		.each('end', function(d) {
			d.linksThisNodeIsSource = newLinks.filter(function(l) { return l.source.pID === d.pID; });
			d.linksThisNodeIsSource.classed('hidden', false)
				.classed('visible', true);
			drawLinks(d.linksThisNodeIsSource);
			var clusterSplit = d.cluster.split(':');


			// Put up annotation if a node comes from a new cluster
			// Also reveal this cluster in the legend
			var clusterIndex = self.clustersToAnnotate.indexOf(clusterSplit[0])
			if (clusterIndex > -1)
				{ if ( (self.doAnnotations ) && ( !self.clusters[clusterIndex].alreadyAnnotated ))
					{ self.annotationNewCluster(d);
					d3.select('#legendCluster' + self.clusters[clusterIndex].cluster)
						.transition().delay(1000).duration(2000)
						.style('opacity', 1);
					self.clusters[clusterIndex].alreadyAnnotated = true; } }

			// Put up annotation when the highest Eigenfactor node appears
			// Commented out because it happens too early for this paper and interferes with flow
			//if (d.EF === d3.max(self.allNodes, function(dd) { return dd.EF; }))
				//{ console.log('highest EF'); self.annotationHighestEF(d); }

		});
	d3.selectAll('.node').on('mouseover', self.displayNodeInfo)
//		.on('mouseout', function() { setTimeout( function() {
//			d3.select('#nodeInfo').select('p').html('')
//		}, 2500)});
		//.on('mouseout', function() { 
		//	d3.select('#nodeInfo').transition().delay(2500)
		//		.attr('class', 'hidden');
		//});
	


};

hieterGraph.prototype.annotation1 = function() {
	var self = this;

	// TODO: this was hacked together. make it better.
	// see the CSS animations
	//var annotation1Grp = self.svg.append('g');
	//self.annotation1Div = annotation1Grp.append('foreignObject').attr('class', 'externalObject') 
        //                        .attr('x', 150) 
        //                        .attr('y', 150) 
        //                        .attr('height', 500) 
        //                        .attr('width', 300) 
        //                        .append('xhtml:div') 
        //                        .attr('class', 'annotation fadeIn'); 
        //self.annotation1Div.append('p') 
        //        .html('The paper'); 
        //self.annotation1Div.append('p') 
        //        .html('<strong>Ctf7p is essential for sister chromatid cohesion and links mitotic chromosome structure to the DNA replication machinery</strong>'); 
        //self.annotation1Div.append('p') 
        //        .html('was published in the journal <em>Genes & Development</em> in 1999.');
	//
	//
	//self.annotation1Div.transition()
	//	.delay(8000)
	//	.attr('class', 'annotation fadeOut');


	self.annotation1Div = self.svg.append('foreignObject').attr('class', 'externalObject')
		.attr('x', self.annotationPositions[0].x)
		.attr('y', self.annotationPositions[0].y)
		.attr('height', self.annotationHeight)
		.attr('width', self.annotationWidth)
		.append('xhtml:div')
		.attr('class', 'annotation')
		.attr('id', 'annotation1')
		.style('opacity', 0);
        self.annotation1Div.append('p') 
                .html('The paper'); 
        self.annotation1Div.append('p') 
                .html('<strong>Ctf7p is essential for sister chromatid cohesion and links mitotic chromosome structure to the DNA replication machinery</strong>'); 
        self.annotation1Div.append('p') 
                .html('was published in the journal <em>Genes & Development</em> in 1999.');
	self.annotation1Div.append('p')
		.html('Here is the impact it has had since.');
	
	var $annotation1Div = $('#annotation1');
	$annotation1Div.delay(300).fadeTo(2000, 1, 'linear').delay(3000).fadeTo(3000, 0);
};

hieterGraph.prototype.annotationNewCluster = function(n) {
	var self = this;
	if (self.timer) clearInterval(self.timer);
	self.timer = 0;
	var clusterSplit = n.cluster.split(':');
	var clusterInfo = self.clusters[self.clustersToAnnotate.indexOf(clusterSplit[0])];
	// Adjust position based on where the node is
	if (n.x > self.width/2) 
		{ var position = self.annotationPositions[0]; }
	else
		{ var position = self.annotationPositions[1]; }
	var externalObj = self.svg.append('foreignObject').attr('class', 'externalObject')
		.attr('x', position.x)
		.attr('y', position.y)
		.attr('height', self.annotationHeight)
		.attr('width', self.annotationWidth)
	var annotationDiv = externalObj.append('xhtml:div')
		.attr('class', 'annotation')
		.attr('id', 'annotationCluster' + clusterInfo.cluster)
		.style('opacity', 0);
        annotationDiv.append('p') 
                .html('In ' + self.currYear + ' our paper was cited by the paper'); 
        annotationDiv.append('p') 
                .html('<strong>' + n.Title + '</strong>,'); 
        annotationDiv.append('p') 
                .html('a paper in the field:');
        annotationDiv.append('p') 
		.style('color', clusterInfo.color)
		.style('font-weight', 'bold')
		.html(clusterInfo.title + ',');
	annotationDiv.append('p')
		.html('the first time it was cited in this field.');
	console.log(n);
	d3.selectAll('.node')
		.filter(function(d) {return d.pID===n.pID;})
		.transition().delay(1000).duration(3000)
		.attr('r', 30)
		//.attr('r', function(d) { console.log(d3.select(this).attr('r')); return d3.select(this).attr('r') + 20; });
		.transition().delay(3000).duration(3000)
		.attr('r', function(d) { console.log(d3.select(this).attr('r')); return d3.select(this).attr('r'); });
	self.svg.append('svg:line')
		.attr('x1', position.x + (self.annotationWidth/2))
		.attr('x2', n.x)
		.attr('y1', position.y + (self.annotationHeight/5))
		.attr('y2', n.y)
		.attr('stroke-width', 2)
		.attr('stroke', clusterInfo.color)
		.style('stroke-dasharray', ('5, 2'))
		.style('opacity', 0)
		.transition().delay(300).duration(2000)
		.style('opacity', .7)
		.transition().delay(3000).duration(3000)
		.style('opacity', 0);
	
	var $annotation1Div = $('#annotationCluster' + clusterInfo.cluster);
	//$annotation1Div.delay(300).fadeTo(2000, 1, 'linear').delay(1000).fadeTo(3000, 0, function() {self.startIntervalTimer();});
	$annotation1Div.delay(300).fadeTo(2000, 1, 'linear').delay(1000).fadeTo(3000, 0, self.startIntervalTimer);
	return;
};

hieterGraph.prototype.annotationHighestEF = function(n) {
	var self = this;
	if (self.timer) clearInterval(self.timer);
	self.timer=0;
	var divX = 150;
	var divY = 150;
	var divHeight = 500;
	var divWidth = 300;
	var externalObj = self.svg.append('foreignObject').attr('class', 'externalObject')
		.attr('x', divX)
		.attr('y', divY)
		.attr('height', divHeight)
		.attr('width', divWidth)
	var annotationDiv = externalObj.append('xhtml:div')
		.attr('class', 'annotation')
		.attr('id', 'annotationEF')
		.style('opacity', 0);
        annotationDiv.append('p') 
                .html('In ' + self.currYear + ' our paper was cited by the paper'); 
        annotationDiv.append('p') 
                .html('<strong>' + n.Title + '</strong>.'); 
        annotationDiv.append('p') 
                .html('This is the most influential paper in the network to date.');
	var $annotation1Div = $('#annotationEF');
	$annotation1Div.delay(300).fadeTo(2000, 1, 'linear').delay(1000).fadeTo(3000, 0, function() {self.startIntervalTimer();});
	return;
};


hieterGraph.prototype.makeTick = function () {
    var self = this;
    // cache function creation for tiny optimization
    function x1(d) { return d.source.x; }
    function y1(d) { return d.source.y; }
    function x2(d) { return d.target.x; }
    function y2(d) { return d.target.y; }
    function transform(d) {
	d.x = Math.max(4.5, Math.min(self.width - 4.5, d.x));
	d.y = Math.max(4.5, Math.min(self.height - 4.5, d.y));
        return 'translate(' + d.x + ',' + d.y + ')';
    }
    return function () {
        self.link
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2);
        self.node
            .attr('transform', transform);
    };
};

hieterGraph.prototype.makeForce = function () {
    var self = this;
    return d3.layout.force()
        .size([this.width, this.height])
        .linkDistance(225)
	//.linkDistance(function(d) { console.log(self.ldScl(d.source.Year)); return self.ldScl(d.source.Year) ? 75 + self.ldScl(d.source.Year) : 0;})
        .linkStrength(function(d) { return self.lsScl(d.source.Year) ? self.lsScl(d.source.Year) : 0;})
        .charge(-15)
//        .gravity(0.03)
//        .friction(0.8)
//        .theta(0.9)
//        .alpha(0.1)
        .on('tick', this.tick);
};

hieterGraph.prototype.makeDescription = function() {
	var self = this;

	var description = d3.select('#description')
	//var description = d3.select('body').append('div').attr('class', 'description');
	
	description.append('p').html('Each node represents one paper. Edges represent one paper citing another.');
	description.append('p').html('In order to simplify the display, only ' + self.maxNodes + ' papers are shown (out of ' + self.totalPapersBeforeLimiting + '). Papers with lower Eigenfactor scores are discarded first.');
};

hieterGraph.prototype.legendInit = function() {
	var self = this;

	var squareSize = 15;
	var padding = 5;
	var sqrPlusPadding = squareSize + padding;

	self.legend = self.svg.append('g')
		.attr('class', 'legend')
		.attr('transform', 'translate('+padding+','+padding+')')
		.style('opacity', 1e-9);

	var legendItem = self.legend.append('g')
		.attr('class', 'legendItem')
		.attr('id', 'legendCluster12:32');
	legendItem.append('svg:rect')
		.attr('width', squareSize)
		.attr('height', squareSize)
		.attr('fill', self.colorScheme[4]);
	legendItem.append('svg:text')
		.attr('transform', 'translate('+(sqrPlusPadding)+',0)')
		.attr('dy', '1em')
		.text('Papers in category "Genetics: DNA Replication" (cluster 12:32)');

	var legendItem = self.legend.append('g')
		.attr('class', 'legendItem')
		.attr('id', 'legendCluster12');
	legendItem.append('svg:rect')
		.attr('width', squareSize)
		.attr('height', squareSize)
		.attr('transform', 'translate(0,'+(sqrPlusPadding)+')')
		.attr('fill', self.colorScheme[2]);
	legendItem.append('svg:text')
		.attr('transform', 'translate('+(sqrPlusPadding)+','+sqrPlusPadding+')')
		.attr('dy', '1em')
		.text('Papers in category "Genetics: Other" (cluster 12)');

	// make legend items for other clusters (start off hidden)
	for (var i=0; i < self.clusters.length; i++) {
		var legendItem = self.legend.append('g')
			.attr('class', 'legendItem')
			.attr('id', 'legendCluster' + self.clusters[i].cluster)
			// start off hidden
			.style('opacity', 0);
		legendItem.append('svg:rect')
			.attr('width', squareSize)
			.attr('height', squareSize)
			.attr('transform', 'translate(0,' + (sqrPlusPadding * (2 + i)) + ')')
			.attr('fill', self.clusters[i].color);
		legendItem.append('svg:text')
			.attr('transform', 'translate(' + (sqrPlusPadding) + ',' + (sqrPlusPadding * (2 + i)) + ')')
			.attr('dy', '1em')
			.text('Papers in category "' + self.clusters[i].title + '" (cluster ' + self.clusters[i].cluster + ')');
	}

//	self.legend.append('svg:rect')
//		.attr('width', squareSize)
//		.attr('height', squareSize)
//		.attr('transform', 'translate(0,'+(sqrPlusPadding*2)+')')
//		.attr('fill', self.colorScheme[0]);
//	self.legend.append('svg:text')
//		.attr('transform', 'translate('+(sqrPlusPadding)+','+(sqrPlusPadding*2)+')')
//		.attr('dy', '1em')
//		.text('Papers in category "Cancer and Genetics" (cluster 28)');
//
//	self.legend.append('svg:rect')
//		.attr('width', squareSize)
//		.attr('height', squareSize)
//		.attr('transform', 'translate(0,'+(sqrPlusPadding*3)+')')
//		.attr('fill', self.colorScheme[1]);
//	self.legend.append('svg:text')
//		.attr('transform', 'translate('+(sqrPlusPadding)+','+(sqrPlusPadding*3)+')')
//		.attr('dy', '1em')
//		.text('Papers in category "Immunobiology" (cluster 2)');
};

hieterGraph.prototype.lineChartInit = function() {
	var self = this;

	self.yearsSvg = d3.select('#yearsDiv').append('svg')
		.attr('width', self.yearsWidth + self.yearsMargin.left + self.yearsMargin.right)
		.attr('id', 'yearsSVG')
		.attr('height', self.yearsHeight + self.yearsMargin.top + self.yearsMargin.bottom)
		.append('g')
		.attr('transform', 'translate(' + self.yearsMargin.left + ',' + self.yearsMargin.top + ')');
	self.yearsSvgDefs = self.yearsSvg.append('defs');

	
	// The strategy is to draw the entire line, but use a clip path to only
	// display up to the current year.
	self.yearsClipPath = self.yearsSvgDefs
		.append('clipPath')
		.attr('id', 'clip')
		.append('rect')
		.attr('width', 0)
		.attr('height', self.yearsHeight);
	// The domain for the years is [minimum year minus one, maximum year]
	// Actually, this is already represented in self.yearsFrequencyData
	//self.yearsXScale.domain([d3.time.year.offset(d3.min(self.yearsFrequencyData, function(d) { return d.key; }), -1), 
	//			  d3.max(self.yearsFrequencyData, function(d) { return d.key; })]);
	self.yearsXScale.domain(d3.extent(self.yearsFrequencyData, function(d) { return d.key; }));
	self.yearsYScale.domain([0, d3.max(self.yearsFrequencyData, function(d) { return d.values+5; })]);

	self.xAxis = d3.svg.axis().scale(self.yearsXScale)
		.orient('bottom');
		//.ticks(self.yearsFrequencyData.length);
	
	self.yAxis = d3.svg.axis().scale(self.yearsYScale)
		.orient('left')
		.ticks(2)
		.tickSize(0);
	
	// Define line drawing function
	self.line = d3.svg.line()
		.x(function(d) { return self.yearsXScale(d.key); })
		.y(function(d) { return self.yearsYScale(d.values); });
	
	// Define the area drawing function
	self.area = d3.svg.area()
		.x(function(d) { return self.yearsXScale(d.key); })
		.y0(self.yearsHeight)
		.y1(function(d) { return self.yearsYScale(d.values); });

	self.yearsSvg.append('g')
		.attr('class', 'x axis')
		.attr('transform', 'translate(0,' + self.yearsHeight + ')')
		.call(self.xAxis);

	// Put the year for each axis tick label into a data attribute
	// to be able to get it more easily later
	var yearLabels = self.yearsSvg.select('.x.axis')
				.selectAll('.tick');
	yearLabels
		.attr("data-year", function(d) {return self.yearToStr(d); });

	// Remove the axis label for any year before the ego paper was published
	yearLabels
		.classed('hidden', function(d) {
			var year = +self.yearToStr(d);
			return year < self.egoNode.Year;
		});
	
	// Add a rect for each year label so we can highlight it later
	var yearLabelRect = d3.selectAll('.tick')
		.append('svg:rect')
		.attr('fill', 'none')
		.style('opacity', .2)
		.attr('class', 'highlightRect')
		.each(function(d) {
			var bbox = this.parentNode.getBBox();
			var padding = bbox.width/4
			d3.select(this)
				.attr('x', bbox.x - padding)
				.attr('y', bbox.y)
				.attr('width', bbox.width + padding*2)
				.attr('height', bbox.height);
		});
	// Put text back on top, using jQuery
	$('.tick text').appendTo('#yearsSvg');

	
	self.yearsSvg.append('g')
		.attr('class', 'y axis')
		.call(self.yAxis)
		.append('text')
		.attr('transform', 'rotate(-90)')
		.attr('y', -self.yearsMargin.left/2)
		.attr('x', -(self.yearsHeight + self.yearsMargin.top + self.yearsMargin.bottom)/2)
		//.style('text-anchor', 'middle')
		.text('Num citations')
		.attr('font-size', '.5em');

	self.yearsFrequencyArea = self.yearsSvg.append('g')
		.attr('clip-path', 'url(#clip)')
		.append('path')
		.datum(self.yearsFrequencyData)
		.attr('class', 'area')
		.style('fill', self.colorScheme[4])
		.attr('d', self.area);
	
		
	self.yearsFrequencyLine = self.yearsSvg.append('g')
		.attr('clip-path', 'url(#clip)')
		.append('path')
		.datum(self.yearsFrequencyData)
		.attr('class', 'line')
		.style('stroke', self.colorScheme[4])
		//.style('fill', self.colorScheme[4])
		.attr('d', self.line);

	var currYearDateFormat = self.strToYear(String(self.currYear));
	var currVal = self.yearsFrequencyData.filter(function(d) {
		return d.key - currYearDateFormat == 0; });
	currVal = currVal[0].values
	self.yearsCurrYearVerticalLine = self.yearsSvg.append('svg:line')
		.attr('class', 'verticalLine hidden')
		.attr('x1', self.yearsXScale(currYearDateFormat))
		.attr('x2', self.yearsXScale(currYearDateFormat))
		.attr('y1', self.yearsHeight)
		.attr('y2', self.yearsYScale(currVal))
		.attr('stroke-width', 2)
		.attr('stroke', 'black')
		.style('stroke-dasharray', ('5, 2'))
		.style('opacity', .25);
}

hieterGraph.prototype.updateLineChart = function() {
	var self = this;

	var currYearDateFormat = self.strToYear(String(self.currYear));

	var currVal = self.yearsFrequencyData.filter(function(d) {
		return d.key - currYearDateFormat == 0; });
	currVal = currVal[0].values
	self.yearsCurrYearVerticalLine
		.classed('hidden', false)
		.transition().duration(self.transitionTimePerYear)
		.ease('linear')
		.attr('x1', self.yearsXScale(currYearDateFormat))
		.attr('x2', self.yearsXScale(currYearDateFormat))
		.attr('y2', self.yearsYScale(currVal));
	// Update the clip path to show the part of the line we want (with transition)
	self.yearsClipPath.transition().duration(self.transitionTimePerYear)
		.ease('linear')
		.attr('width', self.yearsXScale(currYearDateFormat));

	// Highlight current year tick label
	self.yearsSvg.selectAll('.highlighted')
		.attr('fill', 'none')
		.classed('highlighted', false);
	self.yearsSvg.selectAll('.tick')
		.filter(function(d) { return this.dataset.year == self.currYear; })
		.select('.highlightRect')
		.attr('fill', self.colorScheme[2])
		.classed('highlighted', true);

};

hieterGraph.prototype.displayNodeInfo = function(d) {
	var self = this;

	var nodeInfo = d3.select('#nodeInfo')
	nodeInfo.classed('hidden', false);
	var spc = "&nbsp;&nbsp;&nbsp;&nbsp;";
	var displayText = "pID: " + d.pID + spc + "cluster: " + d.cluster + spc + "year: " + d.Year ;
	nodeInfo.select('.line1').html(displayText);
	nodeInfo.select('.line2').html(d.Title);
	//nodeInfo.selectAll('p').attr('color', self.colorScheme[4]);
};

	
window.onload = function() {
	var g = new hieterGraph();
};
